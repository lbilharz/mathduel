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
  const [mode, setMode] = useState('mixed');
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
    } else {
      new Audio('/lose.mp3').play();
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
        <h1>1×1 Duel – Training Mode</h1>

        <div style={{ marginBottom: '12px' }}>
          <label><input type="radio" name="mode" value="small" checked={mode === 'small'} onChange={() => setMode('small')} /> kleines 1×1</label>{' '}
          <label><input type="radio" name="mode" value="big" checked={mode === 'big'} onChange={() => setMode('big')} /> großes 1×1</label>{' '}
          <label><input type="radio" name="mode" value="mixed" checked={mode === 'mixed'} onChange={() => setMode('mixed')} /> gemischt</label>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>Max: <input type="number" value={maxQuestions} onChange={e => setMaxQuestions(parseInt(e.target.value,10) || 1)} /></label>
        </div>

        {running && <div>Zeit: {((Date.now() - startTime) / 1000).toFixed(1)} s</div>}
        {!running && results.length > 0 && (
          <>
            <div>
              {results.filter(r => r.correct).length}/{maxQuestions} richtig – {((Date.now() - startTime) / 1000).toFixed(1)}s
            </div>
            <table className="resultTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Aufgabe</th>
                  <th>✔/✖</th>
                  <th>Eingabe</th>
                  <th>Zeit (s)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{i+1}</td>
                    <td>{r.a}×{r.b}</td>
                    <td>{r.correct ? '✔' : '✖'}</td>
                    <td>{r.input}</td>
                    <td>{r.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {!running ? (
          <button className="next-btn" onClick={startGame}>Spiel starten</button>
        ) : (
          question && (
            <div className="card">
              <div className="q">{question.a} × {question.b}</div>
              <div className="display">{answer}</div>
              <div className="keypad">
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} className="key" onClick={() => setAnswer(prev => (prev.length < 3 ? prev + n.toString() : prev))}>{n}</button>
                ))}
                <button className="key" onClick={() => setAnswer(prev => prev.slice(0, -1))}>⌫</button>
                <button className="key" onClick={() => setAnswer(prev => (prev.length < 3 ? prev + '0' : prev))}>0</button>
                <button className="key ok" onClick={handleOk}>OK</button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
