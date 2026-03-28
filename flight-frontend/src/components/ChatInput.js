import React, { useRef, useEffect } from 'react';
import './ChatInput.css';

const CHIPS = [
  'Which airline has the highest average fare?',
  'Show bookings by class',
  'Cancellation rate per airline',
  'Monthly booking trend for 2023',
  'Revenue by extras type',
  'Top 10 by loyalty points',
  'Average duration per airline',
  'Bookings by terminal',
];

export default function ChatInput({ input, setInput, onSend, isLoading, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = Math.min(ref.current.scrollHeight, 130) + 'px';
  }, [input]);

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(input); }
  };

  return (
    <div className="input-area">
      <div className="chips">
        {CHIPS.map((c, i) => (
          <button key={i} className="chip" onClick={() => onSend(c)} disabled={isLoading}>{c}</button>
        ))}
      </div>

      <div className="input-row">
        <span className="input-glyph">›</span>
        <textarea
          ref={ref}
          className="input-ta"
          placeholder="Ask anything about the flight data…"
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={onKey} disabled={isLoading} rows={1}
        />
        {isLoading
          ? <button className="send-btn cancel" onClick={onCancel}><span className="spin"/>Cancel</button>
          : <button className="send-btn" onClick={() => onSend(input)} disabled={!input.trim()}>
              Send
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
        }
      </div>

      <div className="input-footer">
        <span>FlightIQ · Groq LLaMA 3.3 + pandas</span>
        <span>Shift+Enter for new line</span>
      </div>
    </div>
  );
}