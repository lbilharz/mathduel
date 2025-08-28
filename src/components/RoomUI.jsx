// UnifiedProgressBar and ConfigPanel are reused, keep them.
function UnifiedProgressBar({ scorecard, maxQuestions }) {
  // Unified status-to-color mapping for all possible statuses
  const statusColors = {
    fastest: 'limegreen',
    slower: 'gold',
    wrong: 'crimson',
    bothWrong: 'darkred',
    correct: 'limegreen',
    current: 'dodgerblue',
    pending: 'lightgray',
  };
  const count = maxQuestions || (scorecard ? scorecard.length : 10);
  return (
    <div className="progress-container">
      {Array.from({ length: count }).map((_, i) => {
        const entry = scorecard && scorecard[i];
        const bg = entry && entry.status ? (statusColors[entry.status] || 'lightgray') : 'lightgray';
        return <div key={i} className="progress-segment" style={{ backgroundColor: bg }} />;
      })}
    </div>
  );
}
// ConfigPanel extracts the settings UI for both training and duel host
function ConfigPanel({ modeState, setModeState, maxQuestions, setMaxQuestions, onStart }) {
  return (
    <div className="settings">
      <h2>Einstellungen</h2>
      <label>
        <input type="radio" name="mode" value="small" checked={modeState === 'small'} onChange={() => setModeState('small')} />
        {' '}<strong>kleines 1×1</strong>{' '}(1-10)
      </label>
      <label>
        <input type="radio" name="mode" value="big" checked={modeState === 'big'} onChange={() => setModeState('big')} />
        {' '}<strong>großes 1×1</strong>{' '}(10-20)
      </label>
      <label>
        <input type="radio" name="mode" value="mixed" checked={modeState === 'mixed'} onChange={() => setModeState('mixed')} />
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
      <button className="start-btn next-btn" onClick={onStart}>Spiel starten</button>
    </div>
  );
}
import React, { useState, useRef, useEffect } from 'react'
import './RoomUI.css'
import Ably from "ably"
import QRBlock from "./QRBlock"
import Chat from "./Chat"

function generateQuestionPool(mode, maxQuestions) {
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
  const pool = [];
  for (let a = min; a <= max; a++) {
    for (let b = min; b <= max; b++) {
      pool.push({ a, b });
    }
  }
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, maxQuestions);
}

export default function RoomUI({ mode, room, host }) {
  // Debug log state and helper
  const [logs, setLogs] = useState([]);
  // Helper to log events with prefix
  function log(msg, data) {
    const prefix = host ? '[HOST]' : '[GUEST]';
    setLogs(prev => [...prev, prefix + ' ' + msg + (data !== undefined ? ' ' + JSON.stringify(data) : '')]);
  }
  // SHARED STATE HOOKS
  const [modeState, setModeState] = useState('small');
  const [maxQuestions, setMaxQuestions] = useState(10);
  const [scorecard, setScorecard] = useState([]);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [state, setState] = useState('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [running, setRunning] = useState(false);
  // Next-delay overlay for duel
  const [nextDelay, setNextDelay] = useState(false);
  // New: roundId for duel mode
  const [roundId, setRoundId] = useState(null);
  // Only for training:
  const [questions, setQuestions] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [taskStart, setTaskStart] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  // Only for duel:
  const [connected, setConnected] = useState(false)
  // Persistent messages state per room
  const [messages, setMessages] = useState(() => {
    const stored = localStorage.getItem(`chatMessages_${room}`);
    return stored ? JSON.parse(stored) : [];
  });
  const [opponentJoined, setOpponentJoined] = useState(false)
  const [winner, setWinner] = useState(null)
  // Persistent playerId
  const [playerId] = useState(() => {
    let stored = localStorage.getItem("playerId");
    if (!stored) {
      stored = "player-" + Math.floor(Math.random() * 10000);
      localStorage.setItem("playerId", stored);
    }
    return stored;
  });

  // (Removed duplicate log definition, already defined above)

  // Sounds (for both training and duel)
  const winSound = useRef(null);
  const loseSound = useRef(null);
  useEffect(() => {
    winSound.current = new Audio('/win.mp3');
    loseSound.current = new Audio('/lose.mp3');
    winSound.current.preload = 'auto';
    loseSound.current.preload = 'auto';
  }, []);

  // Timer (for both training and duel)
  useEffect(() => {
    let timer;
    if (running) {
      timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [running, startTime]);

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  function formatTimeDetailed(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
  }

  // UNIFIED: Start game logic
  function startGame() {
    if (mode === 'training') {
      setStartTime(Date.now());
      setElapsedTime(0);
      setTaskStart(Date.now());
      setAnswer('');
      setState('idle');
      const qs = generateQuestionPool(modeState, maxQuestions);
      setQuestions(qs); // questions is always the authoritative source
      setCurrentIndex(0);
      setQuestion(qs[0]);
      // Build scorecard as a projection only: {a, b, status, input?, time?}
      const sc = qs.map((q, idx) => ({
        a: q.a,
        b: q.b,
        status: idx === 0 ? 'current' : 'pending',
      }));
      setScorecard(sc);
      setRunning(true);
      log('Training started', { modeState, maxQuestions });
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } else if (mode === 'duel') {
      // Host triggers new round: generate questions once and publish via Ably
      if (!host) return;
      const newRoundId = crypto.randomUUID();
      const qs = generateQuestionPool(modeState, maxQuestions);
      setQuestions(qs); // questions is authoritative source
      // Build scorecard as a projection: {a, b, status, roundId, questionIndex}
      const sc = qs.map((q, idx) => ({
        a: q.a,
        b: q.b,
        status: idx === 0 ? 'current' : 'pending',
        roundId: newRoundId,
        questionIndex: idx,
      }));
      // Publish scorecard to Ably, include roundId in payload
      if (window.Ably && window.AblyRoomChannel) {
        window.AblyRoomChannel.publish("scorecard", { scorecard: sc, mode: modeState, maxQuestions, roundId: newRoundId, questions: qs });
      } else {
        const pid = playerId || ("player-" + Math.floor(Math.random() * 10000));
        const client = new Ably.Realtime({
          authUrl: `/api/ably-token?clientId=${pid}`
        });
        const chan = client.channels.get(`room:${room}`);
        chan.publish("scorecard", { scorecard: sc, mode: modeState, maxQuestions, roundId: newRoundId, questions: qs });
        setTimeout(() => client.close(), 1000);
      }
      setScorecard(sc);
      setCurrentIndex(0);
      setQuestion(qs[0]);
      setAnswer('');
      setState('idle');
      setRunning(true);
      setRoundId(newRoundId);
      log('Duel: started new round', { modeState, maxQuestions, roundId: newRoundId });
    }
  }

  // UNIFIED: handleOk logic
  function handleOk() {
    if (!question) return;
    // Parse answer and check correctness
    const n = parseInt(answer, 10);
    const correct = (!Number.isNaN(n) && n === question.a * question.b);
    const timeMs = Date.now() - (taskStart || Date.now());
    const elapsed = (timeMs / 1000).toFixed(2);
    // Update scorecard entry for currentIndex
    setScorecard(prev => {
      const next = prev.slice();
      next[currentIndex] = {
        ...next[currentIndex],
        input: answer,
        status: correct ? 'correct' : 'wrong',
        time: elapsed,
        timeMs,
      };
      // Advance next question to 'current' if not last
      if (currentIndex + 1 < next.length) {
        next[currentIndex + 1] = {
          ...next[currentIndex + 1],
          status: 'current',
        };
      }
      return next;
    });
    setAnswer('');
    setState(correct ? 'correct' : 'wrong');
    log('Answer submitted', { input: answer, correct, elapsed });
    // Play sounds and vibrate (in both training and duel)
    if (correct) {
      if (winSound.current) {
        const clone = winSound.current.cloneNode();
        clone.play().catch(err => {
          alert("Win sound blocked: " + err);
        });
      }
      if (navigator.vibrate) navigator.vibrate(50);
    } else {
      if (loseSound.current) {
        const clone = loseSound.current.cloneNode();
        clone.play().catch(err => {
          alert("Lose sound blocked: " + err);
        });
      }
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
    // Training: advance to next question after delay
    if (mode === 'training') {
      setTimeout(() => {
        if (currentIndex + 1 >= maxQuestions) {
          setRunning(false);
          log('Training finished', {
            correct: scorecard.filter(r => r.status === 'correct').length,
            total: maxQuestions
          });
        } else {
          const nextIndex = currentIndex + 1;
          setCurrentIndex(nextIndex);
          setQuestion(questions[nextIndex]);
          setTaskStart(Date.now());
          setState('idle');
        }
      }, 300);
    } else if (mode === 'duel') {
      // In duel mode, POST answer to server; do not advance question locally, only update state.
      setState('submitted');
      fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room,
          roundId,
          playerId,
          questionIndex: currentIndex,
          correct,
          answer: n,
          a: question.a,
          b: question.b,
          timeMs,
        })
      }).catch(console.error);
      // Do not advance currentIndex or question here; handled in "result" subscription.
    }
  }


  // Duel mode: Ably setup and listeners
  useEffect(() => {
    if (mode !== 'duel') return;
    const pid = playerId;
    const client = new Ably.Realtime({
      authUrl: `/api/ably-token?clientId=${pid}`
    });
    client.connection.once("connected", () => {
      setConnected(true);
      log('Ably connected', { pid });
    });
    const chan = client.channels.get(`room:${room}`);
    chan.presence.enter({ name: pid });
    log('Entered presence', { pid });
    chan.presence.subscribe("enter", (member) => {
      if (host && member.clientId !== pid) {
        setOpponentJoined(true);
        setMessages(prev => [...prev, "Gegner beigetreten: " + member.clientId]);
        log('Opponent joined', { clientId: member.clientId });
      }
      if (!host && member.clientId !== pid) {
        log('Host joined', { clientId: member.clientId });
      }
    });
    chan.subscribe("scorecard", (msg) => {
      log('Scorecard received', msg.data);
      setQuestions(msg.data.questions || []);
      setScorecard(msg.data.scorecard || []);
      setModeState(msg.data.mode || 'small');
      setMaxQuestions(msg.data.maxQuestions || 10);
      setRunning(true);
      setQuestion((msg.data.questions && msg.data.questions[0]) || (msg.data.scorecard && msg.data.scorecard[0]) || null);
      setCurrentIndex(0);
      setAnswer('');
      setState('idle');
      setRoundId(msg.data.roundId || null);
    });
    chan.subscribe("question", (msg) => {
      setQuestion(msg.data);
      setAnswer('');
      setState('idle');
      setWinner(null);
      setMessages(prev => [...prev, "Frage: " + JSON.stringify(msg.data)]);
      log('Question received', msg.data);
      if (typeof msg.data.maxQuestions === "number") {
        setMaxQuestions(msg.data.maxQuestions);
      }
      setScorecard(prev => {
        const idx = msg.data.questionIndex;
        const next = prev.slice();
        if (!next[idx]) {
          next[idx] = { status: 'current', a: msg.data.a, b: msg.data.b };
        } else {
          if (next[idx].status === 'pending') {
            next[idx] = { ...next[idx], status: 'current' };
          }
        }
        for (let i = 0; i < next.length; ++i) {
          if (i !== idx && (next[i]?.status === 'current')) {
            next[i] = { ...next[i], status: 'pending' };
          }
        }
        return next;
      });
    });
    chan.subscribe("winner", (msg) => {
      setWinner(msg.data);
      setMessages(prev => [...prev, "Winner: " + JSON.stringify(msg.data)]);
      log('Winner received', msg.data);
      setScorecard(prev => {
        const idx = msg.data.questionIndex;
        const next = prev.slice();
        let status = 'pending';
        if (msg.data.bothWrong) {
          status = 'bothWrong';
        } else if (msg.data.correct && msg.data.playerId === pid) {
          status = 'fastest';
        } else if (msg.data.correct && msg.data.playerId !== pid && msg.data.player2Correct) {
          status = 'slower';
        } else if (msg.data.playerId !== pid && msg.data.player2Wrong) {
          status = 'wrong';
        } else if (msg.data.playerId !== pid && msg.data.correct) {
          status = 'wrong';
        } else if (msg.data.playerId === pid && msg.data.correct) {
          status = 'fastest';
        } else if (msg.data.playerId === pid && !msg.data.correct) {
          status = 'wrong';
        }
        if (status === 'pending') {
          if (msg.data.playerId !== pid && msg.data.correct) {
            status = 'wrong';
          }
        }
        if (msg.data.bothWrong) status = 'bothWrong';
        if (msg.data.player2Correct) status = 'slower';
        next[idx] = {
          ...next[idx],
          status,
          a: msg.data.a ?? (next[idx] && next[idx].a),
          b: msg.data.b ?? (next[idx] && next[idx].b),
        };
        return next;
      });
      if (msg.data.playerId === pid) {
        setState("correct");
      } else {
        setState("wrong");
      }
      setTimeout(() => {
        setState("idle");
        setQuestion(null);
        setAnswer('');
        setWinner(null);
      }, 1000);
    });
    chan.subscribe("result", (msg) => {
      log('Result received', msg.data);
      setMessages(prev => [...prev, "Result: " + JSON.stringify(msg.data)]);
      // Determine correctness by checking answer == a * b
      const isCorrect = (typeof msg.data.answer === 'number' &&
        typeof msg.data.a === 'number' &&
        typeof msg.data.b === 'number' &&
        msg.data.answer === msg.data.a * msg.data.b);
      setScorecard(prev => {
        const idx = msg.data.questionIndex;
        const next = prev.slice();
        let status;
        if (isCorrect && msg.data.playerId === pid) {
          status = 'fastest';
        } else if (isCorrect && msg.data.playerId !== pid) {
          status = 'slower';
        } else if (!isCorrect && msg.data.playerId === pid) {
          status = 'wrong';
        } else {
          status = 'pending';
        }
        next[idx] = {
          ...next[idx],
          status,
          a: msg.data.a ?? (next[idx] && next[idx].a),
          b: msg.data.b ?? (next[idx] && next[idx].b),
          input: msg.data.answer,
          timeMs: msg.data.timeMs,
        };
        // Advance to next question for both host and guest, based on the event's questionIndex
        if (typeof idx === 'number') {
          if (idx + 1 < maxQuestions) {
            setCurrentIndex(idx + 1);
            // Use the updated next array for the following question
            const nextEntry = next[idx + 1];
            setQuestion(nextEntry ? { a: nextEntry.a, b: nextEntry.b } : null);
          } else {
            setRunning(false);
            // Use updated scorecard for correct count
            setTimeout(() => {
              log('Duel finished', {
                correct: (next.filter
                  ? next.filter(r => r.status === 'correct' || r.status === 'fastest' || r.status === 'slower').length
                  : 0),
                total: maxQuestions
              });
            }, 0);
          }
        }
        return next;
      });
      if (msg.data.playerId === pid) {
        setState(isCorrect ? "correct" : "wrong");
        setTimeout(() => {
          setState("idle");
        }, 800);
      }
      // Removed outer setCurrentIndex/setQuestion/setRunning/log usage; now handled in setScorecard above.
    });
    return () => {
      chan.unsubscribe();
      client.close();
    };
  }, [mode, room, host, modeState, maxQuestions]);

  // Persist messages to localStorage whenever messages or room changes
  useEffect(() => {
    localStorage.setItem(`chatMessages_${room}`, JSON.stringify(messages));
  }, [messages, room]);

  // UNIFIED RENDER LOGIC
  // TRAINING MODE UI
  if (mode === 'training') {
    return (
      <div className={`flash-wrapper ${state}`}>
        <div className="room-ui">
          <div style={{
            display: 'flex',
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '8px',
          }}>
            <button
              className="start-btn next-btn small-btn"
              onClick={() => window.location.href = '/'}>⛌</button>
            <h1>1×1 Duel – Training</h1>
          </div>
          {!running && (
            <ConfigPanel
              modeState={modeState}
              setModeState={setModeState}
              maxQuestions={maxQuestions}
              setMaxQuestions={setMaxQuestions}
              onStart={startGame}
            />
          )}
          {running && (
            <>
              <div className="timer-bar">
                <p className="timer-text">{formatTime(elapsedTime)}</p>
                <button
                  className="start-btn next-btn"
                  onClick={() => {
                    setRunning(false);
                    setQuestion(null);
                    setAnswer('');
                    setState('idle');
                    log('Training aborted');
                  }}
                >
                  Neu anfangen
                </button>
              </div>
              <UnifiedProgressBar scorecard={scorecard} maxQuestions={maxQuestions} mode="training" />
            </>
          )}
          {!running && scorecard.length > 0 && (
            <div className="results-box">
              <h2>
                {scorecard.filter(r => r.status === 'correct').length}/{maxQuestions} richtig – {formatTimeDetailed(Date.now() - startTime)}
              </h2>
              <table className="resultTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Aufgabe</th>
                    <th>✅</th>
                    <th>Eingabe</th>
                    <th>Zeit (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {scorecard.map((r, i) => (
                    <tr key={i}>
                      <td>{i+1}</td>
                      <td>{r.a}×{r.b}</td>
                      <td>{r.status === 'correct' ? '✅' : r.status === 'wrong' ? '❌' : ''}</td>
                      <td>{r.input ?? ''}</td>
                      <td>{r.time ?? ''}</td>
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
          {/* Debug log textarea */}
          <textarea
            className="debug-log"
            readOnly
            value={logs.join('\n')}
            style={{ width: '100%', height: 120, marginTop: 12, fontSize: 12, fontFamily: 'monospace', resize: 'none', background: '#f9f9f9' }}
          />
        </div>
      </div>
    );
  }

  // DUEL MODE UI (host and guest inline, no extracted DuelHostUI/DuelGuestUI)
  if (mode === 'duel') {
    return (
      <div className="room-ui" style={{position: 'relative'}}>
        <div style={{
          display: 'flex',
          flexDirection: 'row-reverse',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '8px',
        }}>
          <button
            className="start-btn next-btn small-btn"
            onClick={() => window.location.href = '/'}>⛌</button>
          <h1>1×1 Duel {host ? '– Host' : '– Beigetreten'}</h1>
        </div>
        <p>Raum: {room}</p>
        {!connected && <p>Verbinde zu Ably…</p>}
        {host && !opponentJoined && (
          <>
            <QRBlock url={`${window.location.origin}?room=${room}&mode=duel`} />
            <p>Warte auf Gegner…</p>
            <ConfigPanel
              modeState={modeState}
              setModeState={setModeState}
              maxQuestions={maxQuestions}
              setMaxQuestions={setMaxQuestions}
              onStart={startGame}
            />
          </>
        )}
        {host && opponentJoined && (
          <>
            <p>Gegner verbunden! Startbereit 🎉</p>
            <ConfigPanel
              modeState={modeState}
              setModeState={setModeState}
              maxQuestions={maxQuestions}
              setMaxQuestions={setMaxQuestions}
              onStart={startGame}
            />
          </>
        )}
        {/* Timer bar for duel placeholder */}
        <div className="timer-bar" style={{marginBottom: 0}}>
          <p className="timer-text" style={{opacity: 0.5}}>Duel</p>
        </div>
        {/* Unified Progress bar */}
        <UnifiedProgressBar scorecard={scorecard} maxQuestions={maxQuestions} mode="duel" />
        {/* Results table after duel finished */}
        {!running && scorecard.length > 0 && (
          <div className="results-box">
            <h2>
              {scorecard.filter(r => r.status === 'correct' || r.status === 'fastest' || r.status === 'slower').length}/{maxQuestions} richtig
            </h2>
            <table className="resultTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Aufgabe</th>
                  <th>✅</th>
                  <th>Eingabe</th>
                  <th>Zeit (s)</th>
                </tr>
              </thead>
              <tbody>
                {scorecard.map((r, i) => (
                  <tr key={i}>
                    <td>{i+1}</td>
                    <td>{r.a}×{r.b}</td>
                    <td>
                      {r.status === 'fastest' || r.status === 'correct'
                        ? '✅'
                        : r.status === 'slower'
                          ? '✅'
                          : r.status === 'wrong' || r.status === 'bothWrong'
                            ? '❌'
                            : ''}
                    </td>
                    <td>{r.input ?? ''}</td>
                    <td>
                      {typeof r.time === 'string'
                        ? r.time
                        : (typeof r.timeMs === 'number'
                            ? (r.timeMs/1000).toFixed(2)
                            : '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {question && (
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
        {winner && (
          <div className="winner-box">
            <h2>
              Gewinner: {winner.playerId} – Antwort {winner.answer}, Zeit {Math.round(winner.timeMs / 1000)}s
            </h2>
          </div>
        )}
        {/* Overlay for next-delay if losing */}
        {nextDelay && (
          <div
            className="overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.40)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              color: 'white',
              fontWeight: 'bold',
              pointerEvents: 'auto'
            }}
          >
            ⏳ Nächste Aufgabe in 2 s …
          </div>
        )}
        {/* Show chat for all duel players */}
        {connected && <Chat room={room} messages={messages} setMessages={setMessages} />}
        {/* Debug log textarea */}
        <textarea
          className="debug-log"
          readOnly
          value={logs.join('\n')}
          style={{ width: '100%', height: 120, marginTop: 12, fontSize: 12, fontFamily: 'monospace', resize: 'none', background: '#f9f9f9' }}
        />
      </div>
    );
  }
}
