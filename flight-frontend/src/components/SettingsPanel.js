import React from 'react';
import './SettingsPanel.css';

export default function SettingsPanel({ apiKey, setApiKey, onClose }) {
  return (
    <div className="sp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sp-panel">
        <div className="sp-head">
          <span className="sp-title">Configuration</span>
          <button className="sp-x" onClick={onClose}>✕</button>
        </div>
        <div className="sp-body">
          <div className="sp-group">
            <label className="sp-label">API Key (Groq / OpenAI)</label>
            <p className="sp-desc">
              Overrides the server's <code>OPENAI_API_KEY</code> for this session.
              Leave empty to use the environment variable.
            </p>
            <input type="password" className="sp-input" placeholder="gsk_… or sk-…"
              value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off" />
          </div>
          <div className="sp-group">
            <label className="sp-label">Backend</label>
            <p className="sp-desc">
              Currently connecting to <code>{process.env.REACT_APP_API_URL || 'http://localhost:8000'}</code>.
              Change via <code>REACT_APP_API_URL</code> in your <code>.env</code>.
            </p>
          </div>
          <div className="sp-group">
            <label className="sp-label">Shortcuts</label>
            <div className="shortcuts">
              <div className="shortcut"><kbd>Enter</kbd><span>Send message</span></div>
              <div className="shortcut"><kbd>Shift + Enter</kbd><span>New line</span></div>
            </div>
          </div>
        </div>
        <div className="sp-foot">
          <button className="sp-save" onClick={onClose}>Save & Close</button>
        </div>
      </div>
    </div>
  );
}