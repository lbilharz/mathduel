import React, { useState, useRef, useEffect } from 'react'
import './RoomUI.css'
import Ably from "ably"
import QRBlock from "./QRBlock"
import Chat from "./Chat"
import Players from "./Players"

// UnifiedProgressBar and ConfigPanel are reused, keep them.
function UnifiedProgressBar({ scorecard }) {
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
  if (!scorecard) return null;
  return (
    <div className="progress-container">
      {scorecard.map((card) => {
        const bg = card.status ? (statusColors[card.status] || 'lightgray') : 'lightgray';
        return <div key={card.questionIndex} className="progress-segment" style={{ backgroundColor: bg }} />;
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

// Extracted GameUI: shared UI for both training and duel
function GameUI({
  mode,
  running,
  state,
  scorecard,
  question,
  answer,
  setAnswer,
  handleOk,
  elapsedTime,
  startTime,
  maxQuestions,
  formatTime,
  formatTimeDetailed,
  onAbort,
  winner,
  // nextDelay, // REMOVED
  chatProps,
  connected,
  countdown,
}) {
  // Results table row status logic
  function getStatusIcon(r) {
    if (r.status === 'correct') return '✅';
    if (r.status === 'wrong') return '❌';
    if (r.status === 'fastest') return '🥇';
    if (r.status === 'slower') return '🥈';
    if (r.status === 'bothWrong') return '❌❌';
    return '';
  }
  function getTimeCell(r) {
    if (typeof r.time === 'string') return r.time;
    if (typeof r.timeMs === 'number') return (r.timeMs / 1000).toFixed(2);
    return '';
  }
  // Determine the correct count
  function getCorrectCount() {
    return scorecard.filter(r =>
      r.status === 'correct' ||
      r.status === 'fastest' ||
      r.status === 'slower'
    ).length;
  }
  // Determine overall time for results
  function getResultTime() {
    if (startTime) {
      return formatTimeDetailed(Date.now() - startTime);
    }
    return '';
  }
  return (
    <>
      {running && (
        <div className="timer-bar">
          <p className="timer-text">{formatTime(elapsedTime)}</p>
          {onAbort && (
            <button
              className="start-btn next-btn"
              onClick={onAbort}
            >
              Neu anfangen
            </button>
          )}
        </div>
      )}
      <UnifiedProgressBar scorecard={scorecard} maxQuestions={maxQuestions} />
      {/* Question display with countdown overlay for duel */}
      {(running && question) && (
        <>
          {/* Countdown overlay for duel mode */}
          {mode === 'duel' && countdown !== null && (
            <div className="overlay">
              {winner ? (
                <h2>
                  Gewinner: {winner.playerId} – Antwort {winner.answer}, Zeit {(winner.timeMs/1000).toFixed(2)}s
                </h2>
              ) : (
                <p>⏳ Nächste Aufgabe in {countdown}s …</p>
              )}
            </div>
          )}
          {/* Show question only if countdown is null */}
          {(mode === 'training' || countdown === null) && (
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
        </>
      )}
      {scorecard.length > 0 && (
        <div className="results-box">
          <h2>
            {getCorrectCount()}/{maxQuestions} richtig
            {mode === 'training' && startTime && <> – {getResultTime()}</>}
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
            {scorecard.filter(r => r.status !== 'pending').map((r, i) => (
              <tr key={i}>
                <td>{i+1}</td>
                <td>{r.a}×{r.b}</td>
                <td>{getStatusIcon(r)}</td>
                <td>{r.input ?? ''}</td>
                <td>{getTimeCell(r)}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Chat for duel */}
      {mode === 'duel' && connected && chatProps && (
        <Chat {...chatProps} />
      )}
    </>
  );
}

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
  const [logs, setLogs] = useState([]);
  // Store Ably channel for heartbeat
  const [channel, setChannel] = useState(null);
  // Helper to log events with prefix
  function log(message, data) {
    const prefix = host ? '[HOST] ' : '[GUEST] ';
    setLogs(prev => [...prev, prefix + message + (data !== undefined ? ' ' + JSON.stringify(data) : '')]);
  }
  // SHARED STATE HOOKS
  // Track players by heartbeat
  const [players, setPlayers] = useState({});
  const [modeState, setModeState] = useState('small');
  const [maxQuestions, setMaxQuestions] = useState(3);
  const [scorecard, setScorecard] = useState([]);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [state, setState] = useState('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [running, setRunning] = useState(false);
  // Next-delay overlay for duel - REMOVED
  // RevealAt and countdown for duel
  const [revealAt, setRevealAt] = useState(null);
  const [countdown, setCountdown] = useState(null);
  // Countdown effect for duel revealAt
  useEffect(() => {
    if (!revealAt) {
      setCountdown(null);
      return;
    }
    const delay = revealAt - Date.now();
    if (delay <= 0) {
      setCountdown(null);
      return;
    }
    setCountdown(Math.ceil(delay / 1000));
    // Align to next full second
    const firstTimeout = setTimeout(() => {
      setCountdown(Math.ceil((revealAt - Date.now()) / 1000));
      // Now start interval every 1000ms
      const interval = setInterval(() => {
        const left = revealAt - Date.now();
        if (left <= 0) {
          setCountdown(null);
          clearInterval(interval);
        } else {
          setCountdown(Math.ceil(left / 1000));
        }
      }, 1000);
      // Cleanup interval on unmount
      return () => clearInterval(interval);
    }, delay % 1000);
    return () => clearTimeout(firstTimeout);
  }, [revealAt]);
  // New: roundId for duel mode
  const [roundId, setRoundId] = useState(null);
  // Only for training:
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
      // Before generating questions
      const qs = generateQuestionPool(modeState, maxQuestions);
      log('Generated questions', qs);
      setCurrentIndex(0);
      setQuestion(qs[0]);
      log("Training startGame -> setQuestion", { firstQ: qs[0] });
      // Build scorecard as a projection only: {a, b, status, input?, time?}
      const sc = qs.map((q, idx) => ({
        a: q.a,
        b: q.b,
        status: idx === 0 ? 'current' : 'pending',
        questionIndex: idx,
        roundId: null,
      }));
      log('Built scorecard', sc);
      setScorecard(sc);
      log('Scorecard state set');
      setRunning(true);
      log('Training started', { modeState, maxQuestions });
      if (document.documentElement.requestFullscreen) {
        //document.documentElement.requestFullscreen();
      }
    } else if (mode === 'duel') {
      // Host triggers new round: generate questions once and publish via Ably
      if (!host) return;
      const newRoundId = crypto.randomUUID();
      const qs = generateQuestionPool(modeState, maxQuestions);
      // Build scorecard as a projection: {a, b, status, roundId, questionIndex}
      const sc = qs.map((q, idx) => ({
        a: q.a,
        b: q.b,
        status: idx === 0 ? 'current' : 'pending',
        roundId: newRoundId,
        questionIndex: idx,
      }));
      // Add reveal time for countdown
      const revealTime = Date.now() + 3000;
      setRevealAt(revealTime);
      // Publish scorecard to Ably, include roundId in payload and revealAt
      if (window.Ably && window.AblyRoomChannel) {
        window.AblyRoomChannel.publish("scorecard", { scorecard: sc, mode: modeState, maxQuestions, roundId: newRoundId, questions: qs, revealAt: revealTime });
      } else {
        const pid = playerId || ("player-" + Math.floor(Math.random() * 10000));
        const client = new Ably.Realtime({
          authUrl: `/api/ably-token?clientId=${pid}`
        });
        const chan = client.channels.get(`room:${room}`);
        chan.publish("scorecard", { scorecard: sc, mode: modeState, maxQuestions, roundId: newRoundId, questions: qs, revealAt: revealTime });
        setTimeout(() => client.close(), 1000);
      }
      setScorecard(sc);
      setCurrentIndex(0);
      setQuestion(null); // Rely on revealAt mechanism; don't set first question directly
      setAnswer('');
      setState('idle');
      setStartTime(Date.now());
      setRunning(true);
      setRoundId(newRoundId);
      log('Duel: started new round', { modeState, maxQuestions, roundId: newRoundId });
    }
  }

  // UNIFIED: handleOk logic
  function handleOk() {
    log("handleOk CALLED", { mode, currentIndex, answer, state });
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
    setAnswer('');
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
          log("Training next step", { nextIndex, nextQ: scorecard[nextIndex] });
          setCurrentIndex(nextIndex);
          setQuestion(scorecard[nextIndex]);
          setTaskStart(Date.now());
          setState('idle');
        }
      }, 300);
    } else if (mode === 'duel') {
      // In duel mode, publish result directly and return; do not trigger nextQuestion here
      if (window.Ably && window.AblyRoomChannel) {
        window.AblyRoomChannel.publish("result", {
          room,
          roundId,
          playerId,
          questionIndex: currentIndex,
          correct,
          answer: n,
          a: question.a,
          b: question.b,
          timeMs,
          ts: new Date().toISOString(),
        });
      }
      return; // do not trigger nextQuestion here
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
    setChannel(chan);
    chan.subscribe("scorecard", (msg) => {
      log('Scorecard received', msg.data);
      setScorecard(msg.data.scorecard || []);
      setModeState(msg.data.mode || 'small');
      setMaxQuestions(msg.data.maxQuestions || 10);
      setRunning(true);
      setStartTime(Date.now());
      setQuestion((msg.data.scorecard && msg.data.scorecard[0]) || null);
      setCurrentIndex(0);
      setAnswer('');
      setState('idle');
      setRoundId(msg.data.roundId || null);
      setRevealAt(msg.data.revealAt || null);
    });
    chan.subscribe("winner", (msg) => {
      setWinner(msg.data);
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
        setAnswer('');
        setWinner(null);
      }, 1000);
    });
    chan.subscribe("result", (msg) => {
      log('Result received', msg.data);
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
        return next;
      });
      if (msg.data.playerId === pid) {
        setState(isCorrect ? "correct" : "wrong");
        setTimeout(() => {
          setState("idle");
        }, 800);
      }
      // Host: after receiving a result, determine if nextQuestion or duelFinished should be sent
      if (host) {
        chan.publish("winner", msg.data);
        // Only the host triggers nextQuestion/duelFinished
        if (mode === 'duel') {
          const key = msg.data.questionIndex;
          if (key + 1 < maxQuestions) {
            const revealAt = Date.now() + 3000; // 3s Pause
            const payload = { questionIndex: key + 1, revealAt };
            log('[HOST]', "NextQuestion broadcast", payload);
            chan.publish("nextQuestion", payload);
          } else {
            log('[HOST]', "Duel finished", { roundId });
            chan.publish("duelFinished", { roundId });
          }
        }
      }
    });
    // Subscribe to duelFinished event
    chan.subscribe("duelFinished", (msg) => {
      setRunning(false);
      setQuestion(null);
      setWinner(null);
      setCountdown(null);
      log("Duel finished", msg.data);
    });
    // Subscribe to nextQuestion event
    chan.subscribe("nextQuestion", ({ data }) => {
      const { questionIndex, revealAt } = data;
      log(host ? '[HOST]' : '[GUEST]', "NextQuestion received", data);

      setQuestion(null);
      setCountdown(Math.ceil((revealAt - Date.now()) / 1000));

      const interval = setInterval(() => {
        const left = Math.ceil((revealAt - Date.now()) / 1000);
        setCountdown(left > 0 ? left : null);
        if (left <= 0) clearInterval(interval);
      }, 500);

      setTimeout(() => {
        setCurrentIndex(questionIndex);
        setQuestion(scorecard[questionIndex]);
        setCountdown(null);
        setRunning(true);
      }, revealAt - Date.now());
    });
    return () => {
      chan.unsubscribe();
      client.close();
    };
  }, [mode, room, host, modeState, maxQuestions]);

  // Heartbeat hook must run at top level, not inside useEffect
  useHeartbeat(channel, playerId, setPlayers, log);

  // Cleanup interval: remove players older than 30s from players every 5s
  useEffect(() => {
    if (mode !== 'duel') return;
    const cleanup = setInterval(() => {
      setPlayers(prev => {
        const now = Date.now();
        const next = {};
        Object.entries(prev).forEach(([k, v]) => {
          if (v.ts && now - v.ts < 30000) {
            next[k] = v;
          }
        });
        return next;
      });
    }, 5000);
    return () => clearInterval(cleanup);
  }, [mode]);

  // Persist messages to localStorage whenever messages or room changes
  useEffect(() => {
    localStorage.setItem(`chatMessages_${room}`, JSON.stringify(messages));
  }, [messages, room]);

  // Log question changes
  useEffect(() => {
    log("Question changed", question);
  }, [question]);
  // Log scorecard changes
  useEffect(() => {
    log("Scorecard changed", scorecard);
  }, [scorecard]);
  // Log currentIndex changes
  useEffect(() => {
    log("CurrentIndex changed", currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    log("Question CHANGED", { question, currentIndex, running, state });
  }, [question]);

  useEffect(() => {
    if (running) {
      log("Timer started", { startTime });
    } else {
      log("Timer stopped");
    }
  }, [running, startTime]);

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
          <GameUI
            mode={mode}
            running={running}
            state={state}
            scorecard={scorecard}
            question={question}
            answer={answer}
            setAnswer={setAnswer}
            handleOk={handleOk}
            elapsedTime={elapsedTime}
            startTime={startTime}
            maxQuestions={maxQuestions}
            formatTime={formatTime}
            formatTimeDetailed={formatTimeDetailed}
            onAbort={() => {
              setRunning(false);
              setQuestion(null);
              setAnswer('');
              setState('idle');
              log('Training aborted');
            }}
          />
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
        <Players players={players} room={room} />
        {!connected && <p>Verbinde zu Ably…</p>}
        {host && !running && (
          <>
            <QRBlock url={`${window.location.origin}?room=${room}&mode=duel`} />
            <ConfigPanel
              modeState={modeState}
              setModeState={setModeState}
              maxQuestions={maxQuestions}
              setMaxQuestions={setMaxQuestions}
              onStart={startGame}
            />
          </>
        )}
        {/* Shared game UI for duel */}
        <GameUI
          mode="duel"
          running={running}
          state={state}
          scorecard={scorecard}
          question={question}
          answer={answer}
          setAnswer={setAnswer}
          handleOk={handleOk}
          elapsedTime={elapsedTime}
          startTime={startTime}
          maxQuestions={maxQuestions}
          formatTime={formatTime}
          formatTimeDetailed={formatTimeDetailed}
          winner={winner}
          chatProps={{ room, messages, setMessages }}
          connected={connected}
          countdown={countdown}
          onAbort={() => {
            setRunning(false);
            setQuestion(null);
            setAnswer('');
            setState('idle');
            setScorecard([]);
            setCurrentIndex(0);
            setWinner(null);
            setRoundId(null);
            log('Duel aborted');
          }}
        />
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


// Heartbeat Hook
function useHeartbeat(chan, playerId, setPlayers, log) {
  useEffect(() => {
    if (!chan || !playerId) return;
    let heartbeatInterval = null;

    // sofort initial senden
    const first = {
      playerId,
      name: localStorage.getItem("chatName") || playerId,
      ts: Date.now(),
    };
    chan.publish("heartbeat", first);
    log("Heartbeat: send initial", first);

    // alle 10s wiederholen
    heartbeatInterval = setInterval(() => {
      const beat = {
        playerId,
        name: localStorage.getItem("chatName") || playerId,
        ts: Date.now(),
      };
      chan.publish("heartbeat", beat);
      log("Heartbeat: send", beat);
    }, 10000);

    // empfangen
    const handler = (msg) => {
      log("Heartbeat: received", msg.data);
      setPlayers(prev => ({
        ...prev,
        [msg.data.playerId]: msg.data
      }));
    };
    chan.subscribe("heartbeat", handler);

    return () => {
      chan.unsubscribe("heartbeat", handler);
      clearInterval(heartbeatInterval);
      log("Heartbeat: cleanup", { playerId });
    };
  }, [chan, playerId, setPlayers]);
}
