import './App.css'
import React, { useMemo } from 'react'
import { nanoid } from 'nanoid'
import RoomUI from './components/RoomUI'

function getQuery() {
  const q = new URLSearchParams(window.location.search)
  return Object.fromEntries(q.entries())
}

export default function App() {
  const query = useMemo(getQuery, [])
  const room = query.room
  const host = query.host === '1'

  if (room) {
    return <RoomUI room={room} host={host} />
  }

  const createRoom = () => {
    const id = nanoid(6).toLowerCase()
    const url = new URL(window.location.href)
    url.search = `room=${id}&host=1`
    window.location.href = url.toString()
  }

  return (
    <div className="app-wrap">
      <h1>Math Duel</h1>
      <p>Starte ein neues 1×1‑Duell.</p>
      <button className="app-btn" onClick={createRoom}>Neues Duell starten</button>
      <p className="app-hint">Nach dem Start kannst du den Link oder QR‑Code teilen.</p>
    </div>
  )
}

