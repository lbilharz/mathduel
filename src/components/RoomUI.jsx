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
  const [maxQuestions] = useState(20);
  const [progress, setProgress] = useState([]);

  const [running, setRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [duration, setDuration] = useState(null);

  const [taskStart, setTaskStart] = useState(null);
  const [durations, setDurations] = useState([]);

  // Generate a set of unique questions up to maxQuestions
  function generateUniqueQuestions(mode, count) {
    const questions = new Set();
    while (questions.size < count) {
      const q = randomQuestion(mode);
      questions.add(`${q.a}x${q.b}`);
    }
    return Array.from(questions).map(x => {
      const [a, b] = x.split('x').map(Number);
      return { a, b };
    }).sort(() => Math.random() - 0.5);
  }

  const [questionQueue, setQuestionQueue] = useState([]);

  function nextQuestion() {
    if (!running) return;
    if (progress.length >= maxQuestions) {
      setRunning(false);
      setDuration(((Date.now() - startTime) / 1000).toFixed(1));
      return;
    }
    if (progress.length === 0) {
      const qs = generateUniqueQuestions(mode, maxQuestions);
      setQuestion(qs[0]);
      setQuestionQueue(qs.slice(1));
      setTaskStart(Date.now());
    } else {
      setQuestion(questionQueue.shift());
      setTaskStart(Date.now());
    }
    setAnswer('');
    setState('idle');
  }

  function onChange(e) {
    setAnswer(e.target.value);
  }

  return (
    <div className={`flash-wrapper ${state}`}>
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

        {running && <div>Zeit: {((Date.now() - startTime)/1000).toFixed(1)} s</div>}
        {!running && duration && <div>Gesamtzeit: {duration}s</div>}
        {!running && duration && (
          <>
            <div>{progress.filter(p => p === true).length}/{maxQuestions} richtig – {duration}s</div>
            <table className="resultTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Aufgabe</th>
                  <th>✔/✖</th>
                  <th>Zeit (s)</th>
                </tr>
              </thead>
              <tbody>
                {progress.map((p, i) => (
                  <tr key={i}>
                    <td>{i+1}</td>
                    <td>{questionQueue[i] ? `${questionQueue[i].a}×${questionQueue[i].b}` : ''}</td>
                    <td>{p ? '✔' : '✖'}</td>
                    <td>{durations[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="progress">
          {Array.from({ length: maxQuestions }).map((_, i) => (
            <span key={i} className={progress[i] === true ? 'tick' : progress[i] === false ? 'cross' : ''}>
              {progress[i] === true ? '✔️' : progress[i] === false ? '❌' : '⬜'}
            </span>
          ))}
        </div>

        {!running ? (
          <button className="next-btn" onClick={() => {
            setProgress([]);
            setRunning(true);
            setStartTime(Date.now());
            const qs = generateUniqueQuestions(mode, maxQuestions);
            setQuestion(qs[0]);
            setQuestionQueue(qs.slice(1));
          }}>Spiel starten</button>
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
                <button className="key ok" onClick={() => {
                  const n = parseInt(answer, 10);
                  const correct = (!Number.isNaN(n) && n === question.a * question.b);
                  const elapsed = ((Date.now() - taskStart) / 1000).toFixed(1);
                  setDurations(prev => [...prev, elapsed]);
                  if (correct) {
                    setProgress(prev => [...prev, true]);
                    setState('correct');
                    new Audio('/win.wav').play();
                  } else {
                    setProgress(prev => [...prev, false]);
                    setState('wrong');
                    new Audio('/lose.wav').play();
                  }
                  setTimeout(() => {
                    if (progress.length + 1 >= maxQuestions) {
                      setRunning(false);
                      setDuration(((Date.now() - startTime) / 1000).toFixed(1));
                    } else {
                      setAnswer('');
                      nextQuestion();
                    }
                  }, 300);
                }}>OK</button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
