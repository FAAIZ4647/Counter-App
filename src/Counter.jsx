import { useState, useEffect, useRef, useCallback } from 'react'
import './Counter.css'

// Web Audio API tactile feedback synthesizer
function playClickSound(type = 'up', muted = false) {
  if (muted) return
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    if (type === 'up') {
      // Crisp snappy tactile pop
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(500, now)
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.035)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
      osc.start(now)
      osc.stop(now + 0.045)
    } else if (type === 'down') {
      // Warm wood-tone tick
      osc.type = 'sine'
      osc.frequency.setValueAtTime(420, now)
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.04)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
      osc.start(now)
      osc.stop(now + 0.045)
    } else if (type === 'reset') {
      // Gentle chord for reset
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(340, now)
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.06)
      gain.gain.setValueAtTime(0.1, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
      osc.start(now)
      osc.stop(now + 0.075)
    }
  } catch {
    // Graceful fallback if audio is not permitted
  }
}

function Counter() {
  const [count, setCount] = useState(0)
  const [step, setStep] = useState(1)
  const [history, setHistory] = useState([])
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('claude-counter-theme') || 'light'
    } catch {
      return 'light'
    }
  })
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem('claude-counter-muted') === 'true'
    } catch {
      return false
    }
  })
  const [goal, setGoal] = useState(50)
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [tempGoal, setTempGoal] = useState('50')
  const [isEditingCount, setIsEditingCount] = useState(false)
  const [tempCount, setTempCount] = useState('0')
  const [animDirection, setAnimDirection] = useState(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [totalClicks, setTotalClicks] = useState(0)
  const [peakCount, setPeakCount] = useState(0)

  const countInputRef = useRef(null)
  const goalInputRef = useRef(null)

  // Sync theme attribute to documentElement
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('claude-counter-theme', theme)
    } catch {
      // Storage unavailable
    }
  }, [theme])

  // Sync mute to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('claude-counter-muted', String(isMuted))
    } catch {
      // Storage unavailable
    }
  }, [isMuted])

  // Focus input when editing
  useEffect(() => {
    if (isEditingCount && countInputRef.current) {
      countInputRef.current.focus()
      countInputRef.current.select()
    }
  }, [isEditingCount])

  useEffect(() => {
    if (isEditingGoal && goalInputRef.current) {
      goalInputRef.current.focus()
      goalInputRef.current.select()
    }
  }, [isEditingGoal])

  // Change handler with animation & activity tracking
  const changeCount = useCallback((delta) => {
    playClickSound(delta > 0 ? 'up' : 'down', isMuted)
    setAnimDirection(delta > 0 ? 'up' : 'down')
    setTimeout(() => setAnimDirection(null), 250)

    setCount((prev) => {
      const next = prev + delta
      setPeakCount((currPeak) => Math.max(currPeak, next))
      setHistory((prevHistory) => [
        {
          id: Date.now() + Math.random(),
          delta,
          previous: prev,
          result: next,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        ...prevHistory.slice(0, 19),
      ])
      return next
    })
    setTotalClicks((prev) => prev + 1)
  }, [isMuted])

  const handleReset = useCallback(() => {
    if (count === 0) return
    playClickSound('reset', isMuted)
    setAnimDirection('reset')
    setTimeout(() => setAnimDirection(null), 250)

    setHistory((prev) => [
      {
        id: Date.now() + Math.random(),
        delta: 'RESET',
        previous: count,
        result: 0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...prev.slice(0, 19),
    ])
    setCount(0)
    setTotalClicks((prev) => prev + 1)
  }, [count, isMuted])

  const handleUndo = useCallback(() => {
    if (history.length === 0) return
    const lastAction = history[0]
    playClickSound('down', isMuted)
    setCount(lastAction.previous)
    setHistory((prev) => prev.slice(1))
    setTotalClicks((prev) => prev + 1)
  }, [history, isMuted])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        if (e.key === 'Escape') {
          setIsEditingCount(false)
          setIsEditingGoal(false)
        }
        return
      }

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyK') {
        e.preventDefault()
        changeCount(step)
      } else if (e.code === 'ArrowDown' || e.code === 'KeyJ') {
        e.preventDefault()
        changeCount(-step)
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handleReset()
      } else if ((e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) || e.code === 'KeyU') {
        e.preventDefault()
        handleUndo()
      } else if (e.code === 'KeyM') {
        e.preventDefault()
        setIsMuted((m) => !m)
      } else if (e.code === 'KeyT') {
        e.preventDefault()
        setTheme((t) => (t === 'light' ? 'dark' : 'light'))
      } else if (e.code === 'Digit1') {
        setStep(1)
      } else if (e.code === 'Digit2') {
        setStep(5)
      } else if (e.code === 'Digit3') {
        setStep(10)
      } else if (e.code === 'Digit4') {
        setStep(25)
      } else if (e.code === 'Escape') {
        setShowShortcuts(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [changeCount, handleReset, handleUndo, step])

  // Direct editing of count
  const submitCountEdit = (e) => {
    if (e) e.preventDefault()
    const parsed = parseInt(tempCount, 10)
    if (!isNaN(parsed)) {
      setCount(parsed)
      setPeakCount((curr) => Math.max(curr, parsed))
      setHistory((prev) => [
        {
          id: Date.now(),
          delta: `EDIT (${parsed >= count ? '+' : ''}${parsed - count})`,
          previous: count,
          result: parsed,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        ...prev.slice(0, 19),
      ])
    }
    setIsEditingCount(false)
  }

  // Direct editing of goal
  const submitGoalEdit = (e) => {
    if (e) e.preventDefault()
    const parsed = parseInt(tempGoal, 10)
    if (!isNaN(parsed) && parsed > 0) {
      setGoal(parsed)
    }
    setIsEditingGoal(false)
  }

  const goalPercentage = goal > 0 ? Math.min(Math.round((count / goal) * 100), 100) : 0
  const isGoalReached = goal > 0 && count >= goal

  return (
    <div className="claude-app">
      {/* Top Floating Controls Bar */}
      <header className="claude-navbar">
        <div className="claude-nav-actions">
          <button
            type="button"
            className={`nav-icon-button ${!isMuted ? 'active' : ''}`}
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute click sound (Press M)' : 'Mute click sound (Press M)'}
            aria-label="Toggle sound feedback"
          >
            {isMuted ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
            <span className="nav-btn-label">{isMuted ? 'Muted' : 'Sound'}</span>
          </button>

          <button
            type="button"
            className="nav-icon-button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title="Toggle Light / Dark mode (Press T)"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
            <span className="nav-btn-label">{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>

          <button
            type="button"
            className={`nav-icon-button ${showShortcuts ? 'active' : ''}`}
            onClick={() => setShowShortcuts(!showShortcuts)}
            title="Keyboard shortcuts guide"
            aria-label="Show shortcuts"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <line x1="6" y1="8" x2="6.01" y2="8" />
              <line x1="10" y1="8" x2="10.01" y2="8" />
              <line x1="14" y1="8" x2="14.01" y2="8" />
              <line x1="18" y1="8" x2="18.01" y2="8" />
              <line x1="6" y1="12" x2="6.01" y2="12" />
              <line x1="18" y1="12" x2="18.01" y2="12" />
              <line x1="7" y1="16" x2="17" y2="16" />
            </svg>
            <span className="nav-btn-label">Shortcuts</span>
          </button>
        </div>
      </header>

      {/* Main Container Card */}
      <main className="claude-main">
        {/* Shortcuts Dropdown Modal */}
        {showShortcuts && (
          <aside className="shortcuts-panel" aria-label="Keyboard Shortcuts">
            <div className="shortcuts-header">
              <h3>Keyboard Shortcuts</h3>
              <button
                type="button"
                className="close-shortcuts-btn"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close shortcuts"
              >
                ✕
              </button>
            </div>
            <div className="shortcuts-grid">
              <div className="shortcut-row">
                <span className="shortcut-desc">Increment counter</span>
                <span className="shortcut-keys"><kbd>Space</kbd> or <kbd>↑</kbd></span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Decrement counter</span>
                <span className="shortcut-keys"><kbd>↓</kbd></span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Reset count</span>
                <span className="shortcut-keys"><kbd>R</kbd></span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Undo last action</span>
                <span className="shortcut-keys"><kbd>Ctrl</kbd>+<kbd>Z</kbd> or <kbd>U</kbd></span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Step magnitude presets</span>
                <span className="shortcut-keys"><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd></span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Mute / Unmute click sounds</span>
                <span className="shortcut-keys"><kbd>M</kbd></span>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Toggle Dark / Light mode</span>
                <span className="shortcut-keys"><kbd>T</kbd></span>
              </div>
            </div>
          </aside>
        )}

        <section className="claude-card" aria-label="Counter Application">
          {/* Header Typography with Claude Editorial Serif */}
          <div className="card-header">
            <div className="kicker-pill">
              <span className="kicker-dot" />
              <span>Thoughtful Tracking</span>
            </div>
            <h1 className="claude-title">
              The <em>Rhythm</em> Counter
            </h1>
            <p className="claude-subtitle">
              Precision cadence for your ideas, rituals, and daily iterations.
            </p>
          </div>

          {/* Goal Progress Bar */}
          <div className="goal-section">
            <div className="goal-info">
              <div className="goal-label">
                <span>Target Goal:</span>
                {isEditingGoal ? (
                  <form onSubmit={submitGoalEdit} className="inline-edit-form">
                    <input
                      ref={goalInputRef}
                      type="number"
                      min="1"
                      className="goal-input"
                      value={tempGoal}
                      onChange={(e) => setTempGoal(e.target.value)}
                      onBlur={submitGoalEdit}
                      aria-label="Edit target goal"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    className="goal-value-btn"
                    onClick={() => {
                      setTempGoal(String(goal))
                      setIsEditingGoal(true)
                    }}
                    title="Click to edit goal"
                    aria-label={`Target goal is ${goal}. Click to edit.`}
                  >
                    <strong>{goal}</strong>
                    <svg className="edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>
                )}
              </div>
              <span className={`goal-pct ${isGoalReached ? 'completed' : ''}`}>
                {isGoalReached ? '✦ Goal Reached!' : `${goalPercentage}%`}
              </span>
            </div>

            <div className="progress-track" role="progressbar" aria-valuenow={goalPercentage} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`progress-fill ${isGoalReached ? 'is-complete' : ''}`}
                style={{ width: `${Math.max(0, goalPercentage)}%` }}
              />
            </div>
          </div>

          {/* Numerical Display */}
          <div className="counter-display-wrapper">
            <div className="display-tag">CURRENT COUNT</div>

            {isEditingCount ? (
              <form onSubmit={submitCountEdit} className="count-edit-form">
                <input
                  ref={countInputRef}
                  type="number"
                  className="count-edit-input"
                  value={tempCount}
                  onChange={(e) => setTempCount(e.target.value)}
                  onBlur={submitCountEdit}
                  aria-label="Enter exact count"
                />
                <button type="submit" className="save-count-btn">Done</button>
              </form>
            ) : (
              <div
                className={`counter-number ${animDirection ? `anim-${animDirection}` : ''}`}
                onClick={() => {
                  setTempCount(String(count))
                  setIsEditingCount(true)
                }}
                title="Click to type a custom value directly"
                role="button"
                tabIndex={0}
                aria-label={`Current count is ${count}. Click to edit directly.`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setTempCount(String(count))
                    setIsEditingCount(true)
                  }
                }}
              >
                {count}
              </div>
            )}

            <div className="direct-edit-hint">
              <span>Click number to edit directly</span>
            </div>
          </div>

          {/* Step Size Selector */}
          <div className="step-selector-row">
            <span className="step-label">Step magnitude:</span>
            <div className="step-pill-group" role="radiogroup" aria-label="Select count step increment">
              {[1, 5, 10, 25, 50].map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={step === s}
                  className={`step-pill ${step === s ? 'active' : ''}`}
                  onClick={() => setStep(s)}
                >
                  ±{s}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="primary-actions">
            <button
              type="button"
              className="action-button secondary-action"
              onClick={() => changeCount(-step)}
              aria-label={`Decrease count by ${step}`}
            >
              <span className="btn-symbol">−</span>
              <span className="btn-text">Decrease</span>
              <span className="btn-badge">−{step}</span>
            </button>

            <button
              type="button"
              className="action-button primary-action"
              onClick={() => changeCount(step)}
              aria-label={`Increase count by ${step}`}
            >
              <span className="btn-symbol">+</span>
              <span className="btn-text">Increase</span>
              <span className="btn-badge">+{step}</span>
            </button>
          </div>

          {/* Utility Toolbar (Undo, Reset, History Toggle) */}
          <div className="secondary-toolbar">
            <button
              type="button"
              className="tool-btn"
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Undo last action (Ctrl+Z or U)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
              <span>Undo</span>
            </button>

            <button
              type="button"
              className="tool-btn reset"
              onClick={handleReset}
              disabled={count === 0}
              title="Reset counter to 0 (Press R)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>Reset</span>
            </button>

            <button
              type="button"
              className={`tool-btn ${showHistory ? 'active' : ''}`}
              onClick={() => setShowHistory(!showHistory)}
              title="Toggle history log"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>History ({history.length})</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="metrics-bar">
            <div className="metric-item">
              <span className="metric-name">Interactions</span>
              <span className="metric-val">{totalClicks}</span>
            </div>
            <div className="metric-divider" />
            <div className="metric-item">
              <span className="metric-name">Peak Value</span>
              <span className="metric-val">{peakCount}</span>
            </div>
            <div className="metric-divider" />
            <div className="metric-item">
              <span className="metric-name">Step</span>
              <span className="metric-val">±{step}</span>
            </div>
          </div>

          {/* Activity History Drawer */}
          {showHistory && (
            <div className="history-drawer">
              <div className="history-drawer-header">
                <h4>Activity Ledger</h4>
                {history.length > 0 && (
                  <button
                    type="button"
                    className="clear-history-btn"
                    onClick={() => setHistory([])}
                  >
                    Clear
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <p className="history-empty">No logged counts yet. Start clicking!</p>
              ) : (
                <ul className="history-list">
                  {history.map((item) => (
                    <li key={item.id} className="history-row">
                      <div className="history-left">
                        <span className={`delta-badge ${typeof item.delta === 'number' && item.delta > 0 ? 'pos' : item.delta === 'RESET' ? 'reset' : 'neg'}`}>
                          {typeof item.delta === 'number' && item.delta > 0 ? `+${item.delta}` : item.delta}
                        </span>
                        <span className="history-state">
                          {item.previous} → <strong>{item.result}</strong>
                        </span>
                      </div>
                      <time className="history-time">{item.timestamp}</time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="claude-footer">
          <div className="footer-status">
            <span className="footer-pulse" />
            <span>Harmonized for clarity and focus</span>
          </div>
          <div className="footer-hint">
            Tip: Press <kbd>Space</kbd> or <kbd>↑</kbd> to increment quickly
          </div>
        </footer>
      </main>
    </div>
  )
}

export default Counter