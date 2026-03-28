import React, { useState, useEffect } from 'react';
import './Header.css';

const ROUTES = ['SFO → JFK','LAX → ORD','ATL → MIA','DFW → SEA','BOS → DEN','LAS → PHX','MSP → DTW'];

export default function Header({ onClearChat, onSettings, msgCount }) {
  const [idx,   setIdx  ] = useState(0);
  const [flip,  setFlip ] = useState(false);
  const [clock, setClock] = useState('');
  const [light, setLight] = useState(false);

  // Flip-board route cycle
  useEffect(() => {
    const id = setInterval(() => {
      setFlip(true);
      setTimeout(() => { setIdx(i => (i+1) % ROUTES.length); setFlip(false); }, 250);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Apply / remove light class on <body>
  const handleToggle = () => {
    setLight(v => {
      const next = !v;
      if (next) document.body.classList.add('light');
      else      document.body.classList.remove('light');
      return next;
    });
  };

  return (
    <header className="header">
      {/* Logo */}
      <div className="h-logo">
        <div className="h-logo-icon">✈</div>
        <div className="h-logo-text">
          <span className="h-logo-name">FlightIQ</span>
          <span className="h-logo-sub">Data Intelligence</span>
        </div>
      </div>

      {/* Route board */}
      <div className="h-board">
        <span className="h-board-tag">Serving</span>
        <span className={`h-board-route ${flip ? 'flip' : ''}`}>{ROUTES[idx]}</span>
      </div>

      {/* Right cluster */}
      <div className="h-right">
        {/* Live status */}
        <div className="h-status">
          <div className="h-dot" />
          <span className="h-status-text">Live</span>
        </div>

        {/* Message count */}
        {msgCount > 0 && (
          <span className="h-count">{msgCount} msg{msgCount !== 1 ? 's' : ''}</span>
        )}

        {/* Clock */}
        <span className="h-clock">{clock}</span>

        {/* ── Light / Dark toggle ── */}
        <button
          className="theme-toggle"
          onClick={handleToggle}
          title={light ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          <span>{light ? '☀️' : '🌙'}</span>
          <div className={`toggle-track ${light ? 'on' : ''}`}>
            <div className="toggle-thumb" />
          </div>
          <span className="toggle-label">{light ? 'Light' : 'Dark'}</span>
        </button>

        {/* Settings */}
        <button className="h-btn" onClick={onSettings} title="Settings">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {/* Clear */}
        <button className="h-btn del" onClick={onClearChat} title="Clear chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </header>
  );
}