import './App.css'
import React, { useMemo } from 'react'
import { nanoid } from 'nanoid'
import RoomUI from './components/RoomUI'
import Chat from './components/Chat.jsx'

function getQuery() {
  const q = new URLSearchParams(window.location.search)
  return Object.fromEntries(q.entries())
}

export default function App() {
  const query = useMemo(getQuery, [])
  const room = query.room
  const host = query.host === '1'
  const mode = query.mode || null

  if (mode === 'training') {
    return <RoomUI mode="training" />
  }

  if (room && mode === 'duel') {
    return <RoomUI room={room} host={host} mode="duel" />
  }

  const createRoom = () => {
    const id = nanoid(6).toLowerCase()
    const url = new URL(window.location.href)
    url.search = `room=${id}&host=1&mode=duel`
    window.location.href = url.toString()
  }

  const startTraining = () => {
    const url = new URL(window.location.href)
    url.search = `mode=training`
    window.location.href = url.toString()
  }

  return (
    <div className="app-wrap">
      <h1>Math Duel</h1>
      <p>Wähle einen Modus:</p>
      <div className="app-version">
        <button className="app-btn" onClick={startTraining}>Training</button>
        <button className="app-btn" onClick={createRoom}>Neues Duell</button>
      </div>
      <p className="app-hint">Im Duell-Modus kannst du den Link oder QR‑Code teilen.</p>
      <Chat />
    </div>
  )
}

