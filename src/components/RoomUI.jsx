import React, { useEffect, useMemo, useRef, useState } from 'react'
import Ably from 'ably'
import QRBlock from './QRBlock'

function useClientId() {
  const [id] = useState(() => {
    const prev = localStorage.getItem('clientId')
    if (prev) return prev
    const v = crypto.randomUUID()
    localStorage.setItem('clientId', v)
    return v
  })
  return id
}

export default function RoomUI({ room, host }) {
  const clientId = useClientId()
  const [status, setStatus] = useState('connecting')
  const [question, setQuestion] = useState(null) // { roundId, a, b, ts }
  const [winner, setWinner] = useState(null)
  const [answer, setAnswer] = useState('')
  const [ablyError, setAblyError] = useState(null)
  const channelRef = useRef(null)

  const joinUrl = useMemo(() => {
    const url = new URL(window.location.href)
    url.search = `room=${room}`
    return url.toString()
  }, [room])

  // Setup Ably Realtime with token auth
  useEffect(() => {
    const rt = new Ably.Realtime({
      clientId,
      authCallback: async (tokenParams, callback) => {
        try {
          const resp = await fetch('/api/ably-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room, clientId })
          })
          if (!resp.ok) throw new Error('auth failed')
          const { tokenRequest } = await resp.json()
          callback(null, tokenRequest)
        } catch (e) {
          callback(e)
        }
      }
    })

    rt.connection.on('connected', () => setStatus('connected'))
    rt.connection.on('failed', () => setStatus('failed'))

    const ch = rt.channels.get(`room:${room}`)
    channelRef.current = ch

    const onQuestion = (msg) => {
      setWinner(null)
      setAnswer('')
      setQuestion(msg.data)
    }
    const onWinner = (msg) => setWinner(msg.data)

    ch.subscribe('question', onQuestion)
    ch.subscribe('winner', onWinner)

    return () => {
      ch.unsubscribe('question', onQuestion)
      ch.unsubscribe('winner', onWinner)
      rt.close()
    }
  }, [room, clientId])

  const startRound = async () => {
    setWinner(null)
    setAnswer('')
    await fetch('/api/new-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room })
    })
  }

  const submitAnswer = async (e) => {
    e.preventDefault()
    if (!question) return
    const n = parseInt(answer, 10)
    if (Number.isNaN(n)) return
    try {
      await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room,
          roundId: question.roundId,
          playerId: clientId,
          answer: n,
          clientSentAt: new Date().toISOString()
        })
      })
    } catch (e) {
      setAblyError(String(e))
    }
  }

  return (
    <div style={styles.wrap}>
      <h1>Raum {room}</h1>
      <div style={styles.row}>
        <div>Status: <b>{status}</b></div>
        <div style={{ flex: 1 }} />
        <div>Du bist: <b>{host ? 'Host' : 'Gast'}</b></div>
      </div>

      {host && <div style={{ margin: '16px 0' }}><QRBlock url={joinUrl} /></div>}

      <div style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {host && (
          <button style={styles.btn} onClick={startRound}>
            Neue Runde starten
          </button>
        )}
        {!host && <div style={{ fontSize: 14, opacity: 0.7 }}>Warte auf die nächste Frage…</div>}
      </div>

      <hr style={{ margin: '24px 0' }} />

      <div>
        <h2>Frage</h2>
        {question ? (
          <div style={styles.questionBox}>
            <div style={{ fontSize: 28 }}>
              <b>{question.a}</b> × <b>{question.b}</b>
            </div>
            <form onSubmit={submitAnswer} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Deine Antwort"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                style={styles.input}
              />
              <button style={styles.btn}>Senden</button>
            </form>
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>Noch keine Frage aktiv.</div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <h2>Ergebnis</h2>
        {winner ? (
          <div style={styles.winner}>
            {winner.playerId === clientId ? '🎉 Du hast gewonnen!' : '🏁 Gewinner: Spieler ' + winner.playerId.slice(0, 6)}
            <div style={{ fontSize: 12, opacity: 0.7 }}>Zeit: ~{winner.timeMs} ms</div>
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>—</div>
        )}
      </div>

      {ablyError && (
        <div style={{ color: 'crimson', marginTop: 16 }}>Fehler: {ablyError}</div>
      )}
    </div>
  )
}

const styles = {
  wrap: { maxWidth: 720, margin: '32px auto', padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
  row: { display: 'flex', gap: 16, alignItems: 'center' },
  btn: { padding: '10px 14px', borderRadius: 12, border: '1px solid #ddd', background: '#fafafa', cursor: 'pointer' },
  input: { fontSize: 18, padding: '10px 12px', borderRadius: 10, border: '1px solid #ccc', width: 140 },
  questionBox: { border: '1px solid #eee', borderRadius: 12, padding: 16, display: 'inline-block' },
  winner: { background: '#f6ffed', border: '1px solid #b7eb8f', padding: 12, borderRadius: 8 }
}
