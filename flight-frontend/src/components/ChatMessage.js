import React, { useState } from 'react';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { buildChartConfig } from '../utils/chartUtils';
import DataTable from './DataTable';
import './ChatMessage.css';

const TABS = [
  { id:'bar',   icon:'▬', label:'Bar'   },
  { id:'line',  icon:'〰', label:'Line'  },
  { id:'pie',   icon:'◉', label:'Pie'   },
  { id:'table', icon:'⊞', label:'Table' },
];

export default function ChatMessage({ message }) {
  const { role, text, queryResult } = message;
  const [tab,      setTab     ] = useState(message.chartType || 'bar');
  const [showCode, setShowCode] = useState(false);
  const [copied,   setCopied  ] = useState(false);

  const isUser   = role === 'user';
  const isError  = role === 'error';
  const hasData  = queryResult && Array.isArray(queryResult.data) && queryResult.data.length > 0;
  const isScalar = queryResult && !Array.isArray(queryResult.data) && queryResult.data !== null;

  const cfg = hasData && tab !== 'table'
    ? buildChartConfig(tab, queryResult.data, queryResult.question || '')
    : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(queryResult?.generated_code || '');
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={`msg ${role}`}>
      <div className={`msg-av ${role}`}>
        {isUser ? '◈' : isError ? '⚠' : '✦'}
      </div>

      <div className="msg-body">
        <span className="msg-role">{isUser ? 'You' : isError ? 'Error' : 'FlightIQ'}</span>

        <div className={`msg-bubble ${role}`}>
          <p className="msg-text">{text}</p>
          {isScalar && (
            <div className="msg-scalar">
              <span className="scalar-lbl">Result</span>
              <span className="scalar-val">{String(queryResult.data)}</span>
            </div>
          )}
        </div>

        {hasData && (
          <div className="data-panel">
            <div className="panel-bar">
              <div className="panel-meta">
                <span className="p-badge rows">{queryResult.row_count} rows</span>
                {queryResult.columns && <span className="p-badge cols">{queryResult.columns.length} cols</span>}
              </div>

              <div className="chart-tabs">
                {TABS.map(({ id, icon, label }) => (
                  <button key={id} className={`c-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
                    <span>{icon}</span><span>{label}</span>
                  </button>
                ))}
              </div>

              {queryResult.generated_code && (
                <button className={`code-btn ${showCode ? 'on' : ''}`} onClick={() => setShowCode(v => !v)}>
                  {showCode ? 'Hide' : '</> Query'}
                </button>
              )}
            </div>

            {showCode && queryResult.generated_code && (
              <div className="code-panel">
                <div className="code-top">
                  <span>Generated pandas query</span>
                  <button className="copy-btn" onClick={handleCopy}>{copied ? '✓ Done' : 'Copy'}</button>
                </div>
                <pre className="code-pre">{queryResult.generated_code}</pre>
              </div>
            )}

            <div className="chart-zone">
              {tab === 'table' || !cfg
                ? <DataTable data={queryResult.data} columns={queryResult.columns} />
                : <HighchartsReact highcharts={Highcharts} options={cfg} containerProps={{ style:{ width:'100%', height:'320px' } }} />
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}