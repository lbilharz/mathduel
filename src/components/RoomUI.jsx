import React, { useState } from 'react'
import './RoomUI.css'

function randomQuestion(mode) {
  let min, max;
  if (mode === 'small') {
    min = 2;
    max = 10;
  } else if (mode === 'big') {
    min = 10;
    max = 20;
  } else {
    min = 2;
    max = 20;
  }
  const a = min + Math.floor(Math.random() * (max - min + 1));
  const b = min + Math.floor(Math.random() * (max - min + 1));
  return { a, b };
}

export default function RoomUI() {
  const [question, setQuestion] = useState(null)
  const [answer, setAnswer] = useState('')
  const [state, setState] = useState('idle') // idle | correct | wrong
  const [mode, setMode] = useState('mixed'); // 'small', 'big', or 'mixed'

  function nextQuestion() {
    setQuestion(randomQuestion(mode))
    setAnswer('')
    setState('idle')
  }

  function onChange(e) {
    setAnswer(e.target.value);
  }

  return (
    <div className="room-ui">
      <h1>1×1 Duel – Training Mode</h1>

      <div style={{ marginBottom: '16px' }}>
        <label>
          <input
            type="radio"
            name="mode"
            value="small"
            checked={mode === 'small'}
            onChange={() => setMode('small')}
          /> kleines 1×1
        </label>
        {' '}
        <label>
          <input
            type="radio"
            name="mode"
            value="big"
            checked={mode === 'big'}
            onChange={() => setMode('big')}
          /> großes 1×1
        </label>
        {' '}
        <label>
          <input
            type="radio"
            name="mode"
            value="mixed"
            checked={mode === 'mixed'}
            onChange={() => setMode('mixed')}
          /> gemischt
        </label>
      </div>

      {question ? (
        <>
          <div className="card">
            <div className="q">{question.a} × {question.b}</div>
            <input
              autoFocus
              className={`answer-input ${state}`}
              type="number"
              placeholder="Antwort"
              value={answer}
              onChange={onChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && question) {
                  const n = parseInt(answer, 10);
                  if (!Number.isNaN(n) && n === question.a * question.b) {
                    setState('correct');
                    new Audio('/win.wav').play();
                    setTimeout(() => {
                      nextQuestion();
                    }, 2000);
                  } else {
                    setState('wrong');
                    new Audio('/lose.wav').play();
                  }
                }
              }}
            />
          </div>
          <button className="next-btn" onClick={nextQuestion}>Nächste Frage</button>
        </>
      ) : (
        <button className="next-btn" onClick={nextQuestion}>Frage starten</button>
      )}
    </div>
  )
}
