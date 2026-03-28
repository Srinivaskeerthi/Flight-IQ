/**
 * Demo.jsx
 *
 * Interactive demo page that exercises every response type and chart variant.
 * Run standalone with: npm start (from the demo/ entry-point)
 */

import React, { useState } from 'react';
import ChartRenderer from './components/ChartRenderer';
import './demo.css';

// ── Mock response fixtures ────────────────────────────────────────────────────

const FIXTURES = {
  bar: {
    label: 'Bar — Avg Fare by Airline',
    response: {
      question:       'Which airline has the highest average fare?',
      generated_code: "result = df.groupby('airline_name')['fare'].mean().sort_values(ascending=False).reset_index()\nresult.columns = ['airline_name','avg_fare']",
      data: [
        { airline_name: 'Emirates',            avg_fare: 842.3 },
        { airline_name: 'Singapore Airlines',  avg_fare: 788.1 },
        { airline_name: 'Cathay Pacific',      avg_fare: 731.9 },
        { airline_name: 'British Airways',     avg_fare: 698.4 },
        { airline_name: 'Lufthansa',           avg_fare: 671.2 },
        { airline_name: 'Qantas',              avg_fare: 644.5 },
        { airline_name: 'Air France',          avg_fare: 609.8 },
        { airline_name: 'KLM Royal Dutch Airlines', avg_fare: 588.3 },
        { airline_name: 'Delta Air Lines',     avg_fare: 561.7 },
        { airline_name: 'American Airline',    avg_fare: 523.4 },
      ],
      columns:        ['airline_name', 'avg_fare'],
      row_count:      10,
      interpretation: 'Emirates has the highest average fare at $842.30, nearly 61% more than American Airline at $523.40.',
    },
  },

  line: {
    label: 'Line — Monthly Bookings Trend',
    response: {
      question:       'Show monthly booking trend for 2023',
      generated_code: "df['month'] = df['departure_dt'].dt.to_period('M').astype(str)\nresult = df.groupby('month').size().reset_index(name='bookings')",
      data: [
        { month: 'Jan', bookings: 241, cancelled: 38 },
        { month: 'Feb', bookings: 198, cancelled: 29 },
        { month: 'Mar', bookings: 312, cancelled: 54 },
        { month: 'Apr', bookings: 287, cancelled: 41 },
        { month: 'May', bookings: 334, cancelled: 62 },
        { month: 'Jun', bookings: 389, cancelled: 71 },
        { month: 'Jul', bookings: 421, cancelled: 88 },
        { month: 'Aug', bookings: 398, cancelled: 76 },
        { month: 'Sep', bookings: 356, cancelled: 59 },
        { month: 'Oct', bookings: 302, cancelled: 44 },
        { month: 'Nov', bookings: 267, cancelled: 37 },
        { month: 'Dec', bookings: 310, cancelled: 51 },
      ],
      columns:        ['month', 'bookings', 'cancelled'],
      row_count:      12,
      interpretation: 'Bookings peaked in July (421) and dipped in February (198). Cancellations tracked bookings volume throughout the year.',
    },
  },

  pie: {
    label: 'Pie — Revenue Share by Class',
    response: {
      question:       'What is the revenue share by booking class?',
      generated_code: "result = df.groupby('class')['fare'].sum().reset_index()\nresult.columns = ['class', 'total_revenue']",
      data: [
        { class: 'Economy',  total_revenue: 892340 },
        { class: 'Business', total_revenue: 541200 },
        { class: 'First',    total_revenue: 318760 },
      ],
      columns:        ['class', 'total_revenue'],
      row_count:      3,
      interpretation: 'Economy class dominates with 51.6% of total revenue. Business and First class account for 31.3% and 18.4% respectively.',
    },
  },

  table: {
    label: 'Table — Raw Flight Data Sample',
    response: {
      question:       'Show me the first 20 flight bookings',
      generated_code: 'result = df[["airline_name","flght#","class","fare","status","duration_hrs","layovers"]].head(20)',
      data: Array.from({ length: 20 }, (_, i) => ({
        airline_name:  ['Emirates', 'Delta Air Lines', 'JetBlue Airways', 'American Airline', 'Lufthansa'][i % 5],
        'flght#':      1000 + i * 137,
        class:         ['Economy', 'Business', 'First'][i % 3],
        fare:          parseFloat((Math.random() * 900 + 80).toFixed(2)),
        status:        ['Confirmed', 'Pending', 'Cancelled'][i % 3],
        duration_hrs:  parseFloat((Math.random() * 12 + 1).toFixed(2)),
        layovers:      i % 3,
      })),
      columns:        ['airline_name', 'flght#', 'class', 'fare', 'status', 'duration_hrs', 'layovers'],
      row_count:      20,
      interpretation: 'Showing the first 20 bookings across all airlines and cabin classes.',
    },
  },

  text_scalar: {
    label: 'Text — Scalar Result',
    response: {
      question:       'How many total bookings are there?',
      generated_code: 'result = len(df)',
      data:           3477,
      columns:        null,
      row_count:      null,
      interpretation: 'The dataset contains 3,477 flight bookings across 20 airlines for the year 2023.',
    },
  },

  text_only: {
    label: 'Text — Interpretation Only',
    response: {
      question:       'Give me a summary of the dataset',
      generated_code: null,
      data:           null,
      columns:        null,
      row_count:      null,
      interpretation: 'The flight bookings dataset covers 3,477 records across 20 airlines operating in 2023. Fares range from $85 to $965, with Economy class representing about 60% of all bookings. Approximately 22% of flights were cancelled, 34% confirmed, and 44% are still pending. Emirates, Singapore Airlines, and Cathay Pacific consistently show the highest average fares, while domestic US carriers like Southwest and JetBlue are more affordable.',
    },
  },

  multibar: {
    label: 'Bar — Multi-series Comparison',
    response: {
      question:       'Compare confirmed vs cancelled bookings per airline',
      generated_code: "result = df.groupby(['airline_name','status']).size().unstack(fill_value=0).reset_index()",
      data: [
        { airline_name: 'American Airline', confirmed: 42, cancelled: 18, pending: 60 },
        { airline_name: 'Delta Air Lines',  confirmed: 38, cancelled: 22, pending: 38 },
        { airline_name: 'Emirates',         confirmed: 71, cancelled: 31, pending: 108 },
        { airline_name: 'JetBlue Airways',  confirmed: 29, cancelled: 14, pending: 31 },
        { airline_name: 'Lufthansa',        confirmed: 55, cancelled: 24, pending: 77 },
      ],
      columns:        ['airline_name', 'confirmed', 'cancelled', 'pending'],
      row_count:      5,
      interpretation: 'Emirates has the highest volume across all statuses. Cancellation rates are broadly consistent at ~18-22%.',
    },
  },
};

// ── Demo app ──────────────────────────────────────────────────────────────────

export default function Demo() {
  const [activeKey, setActiveKey] = useState('bar');
  const fixture = FIXTURES[activeKey];

  return (
    <div className="demo-root">
      {/* Header */}
      <header className="demo-header">
        <div className="demo-logo">
          <span className="demo-plane">✈</span>
          <div>
            <h1 className="demo-title">CHART RENDERER</h1>
            <p className="demo-subtitle">Component Demo · FlightIQ</p>
          </div>
        </div>
        <p className="demo-desc">
          Select a response type below to see the <code>ChartRenderer</code> component
          in action. Use the tab-strip inside the card to switch chart types.
        </p>
      </header>

      {/* Fixture selector */}
      <nav className="demo-nav">
        {Object.entries(FIXTURES).map(([key, { label }]) => (
          <button
            key={key}
            className={`demo-nav-btn ${activeKey === key ? 'demo-nav-active' : ''}`}
            onClick={() => setActiveKey(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Renderer */}
      <main className="demo-main">
        <ChartRenderer
          key={activeKey}
          response={fixture.response}
          height={380}
        />
      </main>

      {/* Raw JSON viewer */}
      <details className="demo-json">
        <summary>Raw response JSON</summary>
        <pre>{JSON.stringify(fixture.response, null, 2)}</pre>
      </details>
    </div>
  );
}
