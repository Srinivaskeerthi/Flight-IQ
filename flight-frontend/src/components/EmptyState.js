import React from 'react';
import './EmptyState.css';

const CARDS = [
  { emoji:'📊', text:'Which airline has the highest average fare?',   badge:'Bar',   cls:'teal'   },
  { emoji:'📈', text:'Monthly booking trend for 2023',                badge:'Line',  cls:'violet' },
  { emoji:'🥧', text:'Revenue share by booking class',                badge:'Pie',   cls:'coral'  },
  { emoji:'✈️',  text:'Average flight duration per airline',           badge:'Bar',   cls:'teal'   },
  { emoji:'❌',  text:'Cancellation rate per airline',                 badge:'Bar',   cls:'coral'  },
  { emoji:'🏆', text:'Top 10 passengers by loyalty points',           badge:'Table', cls:'gold'   },
];

export default function EmptyState({ onSend }) {
  return (
    <div className="empty">
      <div className="empty-hero">
        <div className="empty-orb">✈</div>
        <h1 className="empty-title">Flight Data Intelligence</h1>
        <p className="empty-sub">
          Ask questions in plain English about 10,000 flight bookings across 20 airlines.
          AI generates pandas queries, runs them, and renders interactive charts instantly.
        </p>
      </div>

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, width:'100%', maxWidth:720 }}>
        <span className="empty-cards-label">Try asking</span>
        <div className="empty-cards">
          {CARDS.map((c, i) => (
            <button key={i} className="empty-card" onClick={() => onSend(c.text)}>
              <span className="card-emoji">{c.emoji}</span>
              <span className="card-text">{c.text}</span>
              <span className={`card-badge ${c.cls}`}>{c.badge}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="empty-stats">
        <div className="stat"><span className="stat-n">10K</span><span className="stat-l">Bookings</span></div>
        <div className="stat"><span className="stat-n">20</span><span className="stat-l">Airlines</span></div>
        <div className="stat"><span className="stat-n">32</span><span className="stat-l">Columns</span></div>
        <div className="stat"><span className="stat-n">2023</span><span className="stat-l">Year</span></div>
      </div>
    </div>
  );
}