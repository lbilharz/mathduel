import React from "react";
import './Players.css'

export default function Players({players, room}) {
  return (
    <div className={'players'}>
      <h3>Spieler im Raum {room}:</h3>
      {Object.keys(players).length > 1 ? (
        <p>{Object.keys(players).length - 1} Gegner verbunden! Startbereit 🎉</p>
      ) : (
        <p>Warte auf Gegner…</p>
      )}
      <ul style={{margin: 0, paddingLeft: 22}}>
        {Object.values(players).map((player) => {
          const name = player.name || player.playerId || '';
          const lastSeen = player.ts ?? player.lastSeen ?? 0;
          const isOnline = (Date.now() - lastSeen) < 15000;
          return (
            <li key={player.playerId || name} style={{marginBottom: 2}}>
                  <span style={{fontSize: '1.2em', verticalAlign: 'middle'}}>
                    {isOnline ? '🟢' : '⚪️'}
                  </span>{' '}
              {name}
            </li>
          );
        })}
      </ul>
    </div>
  )
}
