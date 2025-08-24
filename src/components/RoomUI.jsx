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
  const [mode, setMode] = useState('small');
  const [maxQuestions, setMaxQuestions] = useState(10);
  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [taskStart, setTaskStart] = useState(null);
  const [results, setResults] = useState([]);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [state, setState] = useState('idle');

  function startGame() {
    setResults([]);
    setStartTime(Date.now());
    setTaskStart(Date.now());
    setAnswer('');
    setState('idle');
    setQuestion(randomQuestion(mode));
    setRunning(true);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  }

  function handleOk() {
    if (!question) return;
    const n = parseInt(answer, 10);
    const correct = (!Number.isNaN(n) && n === question.a * question.b);
    const elapsed = ((Date.now() - taskStart) / 1000).toFixed(1);
    setResults(prev => [...prev, {
      a: question.a,
      b: question.b,
      input: answer,
      correct,
      time: elapsed
    }]);
    setAnswer('');
    setState(correct ? 'correct' : 'wrong');
    if (correct) {
      new Audio('/win.mp3').play();
      if (navigator.vibrate) navigator.vibrate(50);
    } else {
      new Audio('/lose.mp3').play();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
    setTimeout(() => {
      if (results.length + 1 >= maxQuestions) {
        setRunning(false);
      } else {
        setQuestion(randomQuestion(mode));
        setTaskStart(Date.now());
        setState('idle');
      }
    }, 300);
  }

  return (
    <div className={`flash-wrapper ${state}`}>
      <div className="room-ui">
        <h1>1×1 Duel – Training</h1>
        {!running && <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1em', fontSize: '120%', borderRadius: '0.5em', background: 'rgba(255, 255, 255, 0.5)', padding: '.4em' }}>
          <h2 style={{margin: 0}}>Einstellungen</h2>
          <label>
            <input type="radio" name="mode" value="small" checked={mode === 'small'} onChange={() => setMode('small')} />
            {' '}<strong>kleines 1×1</strong>{' '}(1-10)
          </label>
          <label>
            <input type="radio" name="mode" value="big" checked={mode === 'big'} onChange={() => setMode('big')} />
            {' '}<strong>großes 1×1</strong>{' '}(10-20)
          </label>
          <label>
            <input type="radio" name="mode" value="mixed" checked={mode === 'mixed'} onChange={() => setMode('mixed')} />
            {' '}<strong>gemischtes 1×1</strong>{' '}(1-20)
          </label>
          <label>
            <select style={{fontSize: '120%'}} value={maxQuestions} onChange={e => setMaxQuestions(parseInt(e.target.value, 10))}>
              {[3, 5, 10, 15, 20].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            {' '}<strong>Aufgaben</strong>
          </label>
          <button style={{alignSelf: 'flex-end', margin: '0 .3em .3em 0'}} className="next-btn" onClick={startGame}>Spiel starten</button>
        </div>}
        {running && (
          <>
            <div
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1em', borderRadius: '0.5em', background: 'rgba(255, 255, 255, 0.5)', padding: '.4em' }}
            >
              <p style={{fontSize: '120%', margin: 0}}>Zeit: {((Date.now() - startTime) / 1000).toFixed(1)}</p>
              <button
                style={{fontSize: '100%'}}
                className="cancel-btn"
                onClick={() => {
                  setRunning(false);
                  setQuestion(null);
                  setAnswer('');
                  setState('idle');
                }}
              >
                Runde stoppen
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '4px', marginTop: '8px' }}>
              {Array.from({ length: maxQuestions }).map((_, i) => {
                const r = results[i];
                let bg = 'lightgray';
                if (r) {
                  bg = r.correct ? 'limegreen' : 'crimson';
                }
                return <div key={i} style={{ flex: 1, height: '12px', backgroundColor: bg, borderRadius: '2px' }} />;
              })}
            </div>
          </>
        )}
        {!running && results.length > 0 && (
          <div style={{ borderRadius: '0.5em', background: 'rgba(255, 255, 255, 0.5)', padding: '.4em'  }}>
            <h2 style={{margin: '0'}}>
              {results.filter(r => r.correct).length}/{maxQuestions} richtig – {((Date.now() - startTime) / 1000).toFixed(1)}s
            </h2>
            <table className="resultTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Aufgabe</th>
                  <th>✅/❌</th>
                  <th>Eingabe</th>
                  <th>Zeit (s)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{i+1}</td>
                    <td>{r.a}×{r.b}</td>
                    <td>{r.correct ? '✅' : '❌'}</td>
                    <td>{r.input}</td>
                    <td>{r.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(running && question) && (
          <div className="card">
            <div className="q">{question.a} × {question.b}</div>
            <div className="display">{answer}</div>
            <div className="keypad">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} className="key" onClick={() => setAnswer(prev => (prev.length < 3 ? prev + n.toString() : prev))}>{n}</button>
              ))}
              <button className="key" onClick={() => setAnswer(prev => prev.slice(0, -1))}>⌫</button>
              <button className="key" onClick={() => setAnswer(prev => (prev.length < 3 ? prev + '0' : prev))}>0</button>
              <button
                className="key ok"
                onClick={handleOk}
                disabled={!answer || state !== 'idle'}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
