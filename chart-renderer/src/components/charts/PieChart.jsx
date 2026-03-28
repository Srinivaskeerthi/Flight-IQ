/**
 * charts/PieChart.jsx
 *
 * Renders a donut / pie chart using Highcharts.
 * Supports:
 *   - donut / full-pie toggle
 *   - grouping of small slices into "Other" when > 10 segments
 *   - percentage labels
 */

import React, { useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { detectAxes, PALETTE, BASE_HC_THEME, fmtLabel, coerceNum } from '../../utils/hcTheme';
import styles from './Chart.module.css';

const OTHER_THRESHOLD = 10; // collapse slices beyond this rank into "Other"

export default function PieChart({ data = [], columns = [], question = '', height = 360 }) {
  const [donut,    setDonut   ] = useState(true);
  const [showOther, setShowOther] = useState(false);

  const options = useMemo(() => {
    if (!data.length) return null;

    const { catKey, valKeys } = detectAxes(data, columns);
    if (!catKey || !valKeys.length) return null;

    const valKey = valKeys[0];

    // Sort descending by value
    let sorted = [...data]
      .map(r => ({ name: String(r[catKey] ?? ''), y: coerceNum(r[valKey]) }))
      .filter(p => p.y > 0)
      .sort((a, b) => b.y - a.y);

    // Collapse tail into "Other"
    if (!showOther && sorted.length > OTHER_THRESHOLD) {
      const top   = sorted.slice(0, OTHER_THRESHOLD);
      const other = sorted.slice(OTHER_THRESHOLD).reduce((acc, p) => acc + p.y, 0);
      sorted = [...top, { name: 'Other', y: other, color: '#484f58' }];
    }

    const pieData = sorted.map((p, i) => ({
      ...p,
      color: p.color ?? PALETTE[i % PALETTE.length],
      sliced: false,
    }));

    return {
      ...BASE_HC_THEME,
      chart: {
        ...BASE_HC_THEME.chart,
        type:   'pie',
        height,
        animation: { duration: 700 },
      },
      title: { text: null },
      plotOptions: {
        pie: {
          innerSize:        donut ? '42%' : '0%',
          borderColor:      '#080c10',
          borderWidth:      2,
          allowPointSelect: true,
          cursor:           'pointer',
          dataLabels: {
            enabled:      true,
            distance:     18,
            format:       '<span style="color:{point.color}">{point.name}</span><br/><b>{point.percentage:.1f}%</b>',
            style: {
              color:       '#e6edf3',
              fontSize:    '11px',
              fontWeight:  '400',
              textOutline: 'none',
              fontFamily:  "'Share Tech Mono', monospace",
            },
            connectorColor: '#2a3f54',
          },
          showInLegend: data.length > 6,
        },
      },
      legend: {
        ...BASE_HC_THEME.legend,
        enabled: data.length > 6,
        maxHeight: 80,
      },
      series: [{
        name: fmtLabel(valKey),
        data: pieData,
      }],
    };
  }, [data, columns, height, donut, showOther]);

  if (!options) return <Empty />;

  const hasTail = data.length > OTHER_THRESHOLD;

  return (
    <div className={styles.chartWrap}>
      <div className={styles.lineControls}>
        <Toggle label="Donut" active={donut} onToggle={() => setDonut(v => !v)} />
        {hasTail && (
          <Toggle
            label={showOther ? `Top ${OTHER_THRESHOLD} only` : 'Show all'}
            active={showOther}
            onToggle={() => setShowOther(v => !v)}
          />
        )}
      </div>
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
        containerProps={{ style: { width: '100%' } }}
      />
    </div>
  );
}

function Toggle({ label, active, onToggle }) {
  return (
    <button
      className={`${styles.toggleBtn} ${active ? styles.toggleActive : ''}`}
      onClick={onToggle}
    >
      {label}
    </button>
  );
}

function Empty() {
  return <p className={styles.empty}>Cannot render pie chart — no numeric values found.</p>;
}
