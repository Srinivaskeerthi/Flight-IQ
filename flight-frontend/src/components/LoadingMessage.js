import React, { useState, useEffect } from 'react';
import './LoadingMessage.css';

const STAGES = ['Parsing question…','Generating pandas query…','Executing on DataFrame…','Interpreting results…'];

export default function LoadingMessage() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS(v => Math.min(v+1, STAGES.length-1)), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="loading">
      <div className="l-av">✦</div>
      <div className="l-body">
        <span className="l-role">FlightIQ</span>
        <div className="l-card">
          <div className="l-stages">
            {STAGES.map((st, i) => (
              <div key={i} className={`l-stage ${i < s ? 'done' : i === s ? 'active' : 'wait'}`}>
                <span className="l-icon">{i < s ? '✓' : i === s ? '›' : '·'}</span>
                <span>{st}</span>
              </div>
            ))}
          </div>
          <div className="l-bar">
            <div className="l-fill" style={{ width:`${((s+1)/STAGES.length)*100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}