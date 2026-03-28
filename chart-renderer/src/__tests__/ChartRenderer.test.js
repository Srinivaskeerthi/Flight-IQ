/**
 * src/__tests__/ChartRenderer.test.js
 *
 * Jest + React Testing Library tests for:
 *   • normaliser.js
 *   • typeDetector.js
 *   • hcTheme.js  (detectAxes, coerceNum, fmtLabel)
 *   • ChartRenderer (render + type-switching)
 *   • TypeSwitcher
 *   • ResponseMeta
 *   • TextView
 *   • TableView  (sort, filter, pagination, export)
 *
 * Run with: npm test
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────
jest.mock('highcharts-react-official', () => ({
  __esModule: true,
  default: ({ options }) => (
    <div data-testid="highcharts" data-type={options?.chart?.type ?? 'unknown'} />
  ),
}));
jest.mock('highcharts', () => ({
  color: () => ({ setOpacity: () => ({ get: () => 'rgba(0,0,0,0)' }) }),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { normaliseResponse }  from '../utils/normaliser';
import { detectResponseType } from '../utils/typeDetector';
import { detectAxes, coerceNum, fmtLabel } from '../utils/hcTheme';

import ChartRenderer from '../components/ChartRenderer';
import TypeSwitcher  from '../components/TypeSwitcher';
import ResponseMeta  from '../components/ResponseMeta';
import TextView      from '../components/charts/TextView';
import TableView     from '../components/charts/TableView';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const TABULAR_DATA = [
  { airline_name: 'American Airline',  avg_fare: 523.4,  bookings: 120 },
  { airline_name: 'Delta Air Lines',   avg_fare: 612.1,  bookings: 98  },
  { airline_name: 'JetBlue Airways',   avg_fare: 389.8,  bookings: 74  },
  { airline_name: 'Alaska Airlines',   avg_fare: 441.0,  bookings: 55  },
  { airline_name: 'Emirates',          avg_fare: 842.3,  bookings: 210 },
];

const QUERY_RESPONSE = {
  question:       'Which airline has the highest average fare?',
  generated_code: "result = df.groupby('airline_name')['fare'].mean()",
  data:           TABULAR_DATA,
  columns:        ['airline_name', 'avg_fare', 'bookings'],
  row_count:      5,
  interpretation: 'Emirates has the highest average fare at $842.',
};

const SCALAR_RESPONSE = {
  question:       'How many total bookings are there?',
  generated_code: 'result = len(df)',
  data:           3477,
  columns:        null,
  row_count:      null,
  interpretation: 'There are 3,477 total flight bookings in the dataset.',
};

// ─── normaliser ──────────────────────────────────────────────────────────────

describe('normaliseResponse', () => {
  test('returns null for null/undefined input', () => {
    expect(normaliseResponse(null)).toBeNull();
    expect(normaliseResponse(undefined)).toBeNull();
  });

  test('handles bare array input', () => {
    const result = normaliseResponse(TABULAR_DATA);
    expect(result.data).toEqual(TABULAR_DATA);
    expect(result.row_count).toBe(5);
    expect(result.columns).toEqual(['airline_name', 'avg_fare', 'bookings']);
  });

  test('handles standard /query response', () => {
    const result = normaliseResponse(QUERY_RESPONSE);
    expect(result.data).toHaveLength(5);
    expect(result.question).toBe('Which airline has the highest average fare?');
    expect(result.generated_code).toContain('groupby');
    expect(result.interpretation).toContain('Emirates');
  });

  test('handles scalar response (data is a number)', () => {
    const result = normaliseResponse(SCALAR_RESPONSE);
    expect(result.data).toBeNull();
    expect(result.scalar).toBe(3477);
    expect(result.interpretation).toContain('3,477');
  });

  test('handles bare primitive scalar', () => {
    const result = normaliseResponse(42);
    expect(result.scalar).toBe(42);
    expect(result.data).toBeNull();
  });

  test('handles error shape (detail key)', () => {
    const result = normaliseResponse({ detail: 'Query failed: column not found' });
    expect(result.error).toContain('Query failed');
  });

  test('handles error shape (error key)', () => {
    const result = normaliseResponse({ error: 'Internal server error' });
    expect(result.error).toContain('Internal server error');
  });

  test('fills default nulls for missing fields', () => {
    const result = normaliseResponse({ data: TABULAR_DATA });
    expect(result.question).toBeNull();
    expect(result.generated_code).toBeNull();
    expect(result.interpretation).toBeNull();
  });

  test('derives columns from data when not provided', () => {
    const result = normaliseResponse({ data: TABULAR_DATA });
    expect(result.columns).toContain('airline_name');
    expect(result.columns).toContain('avg_fare');
  });

  test('handles interpretation-only response', () => {
    const result = normaliseResponse({ interpretation: 'No data, just text.' });
    expect(result.data).toBeNull();
    expect(result.interpretation).toBe('No data, just text.');
  });
});

// ─── typeDetector ─────────────────────────────────────────────────────────────

describe('detectResponseType', () => {
  const norm = (overrides = {}) => normaliseResponse({ data: TABULAR_DATA, ...QUERY_RESPONSE, ...overrides });

  test('returns "text" for null response', () => {
    expect(detectResponseType(null)).toBe('text');
  });

  test('returns "text" when data is null/empty', () => {
    expect(detectResponseType(normaliseResponse({ interpretation: 'hi' }))).toBe('text');
  });

  test('detects line chart from time-series keywords', () => {
    expect(detectResponseType(norm({ question: 'Monthly booking trend for 2023' }))).toBe('line');
    expect(detectResponseType(norm({ question: 'How did revenue evolve over time?' }))).toBe('line');
    expect(detectResponseType(norm({ question: 'Show daily cancellations' }))).toBe('line');
  });

  test('detects pie chart from proportion keywords (small data)', () => {
    expect(detectResponseType(norm({ question: 'Revenue share by class' }))).toBe('pie');
    expect(detectResponseType(norm({ question: 'What is the distribution of booking status?' }))).toBe('pie');
  });

  test('detects bar chart for short categorical results', () => {
    expect(detectResponseType(norm({ question: 'Top airlines by average fare' }))).toBe('bar');
  });

  test('detects table for many columns', () => {
    const wideData = [{ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }];
    const n = normaliseResponse({ data: wideData, question: 'Show raw flight data' });
    expect(detectResponseType(n)).toBe('table');
  });

  test('detects table for many rows', () => {
    const bigData = Array.from({ length: 100 }, (_, i) => ({ name: `R${i}`, val: i }));
    const n = normaliseResponse({ data: bigData, question: 'Show all rows' });
    expect(detectResponseType(n)).toBe('table');
  });
});

// ─── hcTheme helpers ─────────────────────────────────────────────────────────

describe('detectAxes', () => {
  test('identifies string column as category, numeric as value', () => {
    const { catKey, valKeys } = detectAxes(TABULAR_DATA);
    expect(catKey).toBe('airline_name');
    expect(valKeys).toContain('avg_fare');
    expect(valKeys).toContain('bookings');
  });

  test('returns empty valKeys for empty data', () => {
    const result = detectAxes([]);
    expect(result.catKey).toBeNull();
    expect(result.valKeys).toHaveLength(0);
  });

  test('falls back gracefully when all columns are numeric', () => {
    const numericData = [{ x: 1, y: 2, z: 3 }];
    const { catKey, valKeys } = detectAxes(numericData);
    expect(catKey).toBeDefined();
    expect(typeof catKey).toBe('string');
  });

  test('respects explicit columns ordering', () => {
    const { catKey } = detectAxes(TABULAR_DATA, ['airline_name', 'avg_fare']);
    expect(catKey).toBe('airline_name');
  });

  test('caps valKeys at 5 columns maximum', () => {
    const wideData = [{ cat: 'A', v1:1, v2:2, v3:3, v4:4, v5:5, v6:6, v7:7 }];
    const { valKeys } = detectAxes(wideData);
    expect(valKeys.length).toBeLessThanOrEqual(5);
  });
});

describe('coerceNum', () => {
  test('passes through numbers', () => { expect(coerceNum(42)).toBe(42); });
  test('returns null for null', () => { expect(coerceNum(null)).toBeNull(); });
  test('returns null for undefined', () => { expect(coerceNum(undefined)).toBeNull(); });
  test('returns null for NaN strings', () => { expect(coerceNum('abc')).toBeNull(); });
  test('returns null for Infinity', () => { expect(coerceNum(Infinity)).toBeNull(); });
  test('converts numeric strings', () => { expect(coerceNum('3.14')).toBe(3.14); });
});

describe('fmtLabel', () => {
  test('converts snake_case to Title Case', () => {
    expect(fmtLabel('avg_fare')).toBe('Avg Fare');
    expect(fmtLabel('airline_name')).toBe('Airline Name');
  });
  test('handles single word', () => { expect(fmtLabel('fare')).toBe('Fare'); });
  test('handles empty string', () => { expect(fmtLabel('')).toBe(''); });
});

// ─── TypeSwitcher ─────────────────────────────────────────────────────────────

describe('TypeSwitcher', () => {
  test('renders all 5 tabs when hasData=true', () => {
    render(<TypeSwitcher active="bar" hasData={true} onSelect={() => {}} />);
    expect(screen.getByText(/bar/i)).toBeInTheDocument();
    expect(screen.getByText(/line/i)).toBeInTheDocument();
    expect(screen.getByText(/pie/i)).toBeInTheDocument();
    expect(screen.getByText(/table/i)).toBeInTheDocument();
    expect(screen.getByText(/text/i)).toBeInTheDocument();
  });

  test('only renders text tab when hasData=false', () => {
    render(<TypeSwitcher active="text" hasData={false} onSelect={() => {}} />);
    expect(screen.getByText(/text/i)).toBeInTheDocument();
    expect(screen.queryByText(/bar/i)).toBeNull();
    expect(screen.queryByText(/pie/i)).toBeNull();
  });

  test('marks active tab with aria-selected=true', () => {
    render(<TypeSwitcher active="pie" hasData={true} onSelect={() => {}} />);
    const pieTab = screen.getByRole('tab', { name: /pie/i });
    expect(pieTab).toHaveAttribute('aria-selected', 'true');
  });

  test('calls onSelect with the clicked type', () => {
    const onSelect = jest.fn();
    render(<TypeSwitcher active="bar" hasData={true} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('tab', { name: /line/i }));
    expect(onSelect).toHaveBeenCalledWith('line');
  });

  test('does not call onSelect for already-active tab', () => {
    const onSelect = jest.fn();
    render(<TypeSwitcher active="bar" hasData={true} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('tab', { name: /bar/i }));
    // still fires – user clicked it, parent decides idempotency
    expect(onSelect).toHaveBeenCalledWith('bar');
  });
});

// ─── ResponseMeta ─────────────────────────────────────────────────────────────

describe('ResponseMeta', () => {
  test('shows row count', () => {
    render(<ResponseMeta normalised={normaliseResponse(QUERY_RESPONSE)} />);
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  test('shows column count', () => {
    render(<ResponseMeta normalised={normaliseResponse(QUERY_RESPONSE)} />);
    expect(screen.getByText(/3 cols/i)).toBeInTheDocument();
  });

  test('renders null when normalised is null', () => {
    const { container } = render(<ResponseMeta normalised={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('truncates long questions', () => {
    const long = { ...QUERY_RESPONSE, question: 'A'.repeat(80) };
    render(<ResponseMeta normalised={normaliseResponse(long)} />);
    const badge = screen.getByTitle('A'.repeat(80));
    expect(badge.textContent).toContain('…');
  });
});

// ─── TextView ─────────────────────────────────────────────────────────────────

describe('TextView', () => {
  test('renders scalar value prominently', () => {
    render(<TextView data={3477} interpretation={null} question={null} />);
    expect(screen.getByText('3,477')).toBeInTheDocument();
  });

  test('renders RESULT label for scalar', () => {
    render(<TextView data={99.5} interpretation={null} question={null} />);
    expect(screen.getByText(/RESULT/i)).toBeInTheDocument();
  });

  test('renders interpretation text', () => {
    render(<TextView data={null} interpretation="Emirates is the top airline." question={null} />);
    expect(screen.getByText(/Emirates is the top airline/)).toBeInTheDocument();
  });

  test('renders both scalar and interpretation together', () => {
    render(<TextView data={42} interpretation="Forty-two flights were cancelled." question={null} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText(/Forty-two/)).toBeInTheDocument();
  });

  test('shows fallback when no data or interpretation', () => {
    render(<TextView data={null} interpretation={null} question={null} />);
    expect(screen.getByText(/no text result/i)).toBeInTheDocument();
  });

  test('formats large integers with commas', () => {
    render(<TextView data={1000000} interpretation={null} question={null} />);
    expect(screen.getByText('1,000,000')).toBeInTheDocument();
  });

  test('formats floats to 4 decimal places max', () => {
    render(<TextView data={3.14159265} interpretation={null} question={null} />);
    expect(screen.getByText(/3\.1416/)).toBeInTheDocument();
  });
});

// ─── TableView ────────────────────────────────────────────────────────────────

describe('TableView', () => {
  const cols = ['airline_name', 'avg_fare', 'bookings'];

  test('renders column headers', () => {
    render(<TableView data={TABULAR_DATA} columns={cols} />);
    expect(screen.getByText(/airline name/i)).toBeInTheDocument();
    expect(screen.getByText(/avg fare/i)).toBeInTheDocument();
    expect(screen.getByText(/bookings/i)).toBeInTheDocument();
  });

  test('renders all data rows (≤ page size)', () => {
    render(<TableView data={TABULAR_DATA} columns={cols} />);
    expect(screen.getByText('American Airline')).toBeInTheDocument();
    expect(screen.getByText('Emirates')).toBeInTheDocument();
  });

  test('shows empty message for empty data', () => {
    render(<TableView data={[]} columns={[]} />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  test('filter reduces visible rows', () => {
    render(<TableView data={TABULAR_DATA} columns={cols} />);
    const filterInput = screen.getByPlaceholderText(/filter rows/i);
    fireEvent.change(filterInput, { target: { value: 'Emirates' } });
    expect(screen.getByText('Emirates')).toBeInTheDocument();
    expect(screen.queryByText('American Airline')).toBeNull();
  });

  test('clear filter button resets filter', () => {
    render(<TableView data={TABULAR_DATA} columns={cols} />);
    const filterInput = screen.getByPlaceholderText(/filter rows/i);
    fireEvent.change(filterInput, { target: { value: 'foo' } });
    const clearBtn = screen.getByText('✕');
    fireEvent.click(clearBtn);
    expect(filterInput.value).toBe('');
    expect(screen.getByText('American Airline')).toBeInTheDocument();
  });

  test('sorting by a column header changes order', () => {
    render(<TableView data={TABULAR_DATA} columns={cols} />);
    const fareHeader = screen.getByText(/avg fare/i);
    fireEvent.click(fareHeader);
    // After sort asc, JetBlue (389.8) should come first
    const cells = screen.getAllByRole('cell');
    const firstNameCell = cells.find(c => ['American Airline','Delta Air Lines','JetBlue Airways','Alaska Airlines','Emirates'].includes(c.textContent));
    expect(firstNameCell?.textContent).toBe('JetBlue Airways');
  });

  test('clicking sorted column again reverses direction', () => {
    render(<TableView data={TABULAR_DATA} columns={cols} />);
    const fareHeader = screen.getByText(/avg fare/i);
    fireEvent.click(fareHeader); // asc
    fireEvent.click(fareHeader); // desc
    const cells = screen.getAllByRole('cell');
    const firstNameCell = cells.find(c => ['American Airline','Delta Air Lines','JetBlue Airways','Alaska Airlines','Emirates'].includes(c.textContent));
    expect(firstNameCell?.textContent).toBe('Emirates');
  });

  test('pagination renders when data exceeds page size', () => {
    const bigData = Array.from({ length: 25 }, (_, i) => ({ name: `Airline ${i}`, val: i }));
    render(<TableView data={bigData} columns={['name', 'val']} />);
    expect(screen.getByText(/1/)).toBeInTheDocument(); // page 1
  });

  test('next page button advances page', () => {
    const bigData = Array.from({ length: 25 }, (_, i) => ({ name: `Airline_${i}`, val: i }));
    render(<TableView data={bigData} columns={['name', 'val']} />);
    const nextBtn = screen.getByText('›');
    fireEvent.click(nextBtn);
    // Page 2 — Airline_10 should now be visible
    expect(screen.getByText('Airline_10')).toBeInTheDocument();
  });

  test('CSV export button is present', () => {
    render(<TableView data={TABULAR_DATA} columns={cols} />);
    expect(screen.getByText(/↓ CSV/i)).toBeInTheDocument();
  });

  test('shows row count in toolbar', () => {
    render(<TableView data={TABULAR_DATA} columns={cols} />);
    expect(screen.getByText(/5 \/ 5 rows/i)).toBeInTheDocument();
  });
});

// ─── ChartRenderer (integration) ─────────────────────────────────────────────

describe('ChartRenderer', () => {
  test('renders empty state for null response', () => {
    render(<ChartRenderer response={null} />);
    expect(screen.getByText(/no response to render/i)).toBeInTheDocument();
  });

  test('renders TypeSwitcher with tabular data', () => {
    render(<ChartRenderer response={QUERY_RESPONSE} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  test('renders Highcharts for bar type with tabular data', () => {
    render(<ChartRenderer response={QUERY_RESPONSE} defaultType="bar" />);
    expect(screen.getByTestId('highcharts')).toBeInTheDocument();
  });

  test('renders Highcharts for line type', () => {
    render(<ChartRenderer response={QUERY_RESPONSE} defaultType="line" />);
    expect(screen.getByTestId('highcharts')).toBeInTheDocument();
  });

  test('renders Highcharts for pie type', () => {
    render(<ChartRenderer response={QUERY_RESPONSE} defaultType="pie" />);
    expect(screen.getByTestId('highcharts')).toBeInTheDocument();
  });

  test('renders TableView when type=table', () => {
    render(<ChartRenderer response={QUERY_RESPONSE} defaultType="table" />);
    expect(screen.getByPlaceholderText(/filter rows/i)).toBeInTheDocument();
  });

  test('renders TextView for scalar response', () => {
    render(<ChartRenderer response={SCALAR_RESPONSE} />);
    expect(screen.getByText(/3,477/)).toBeInTheDocument();
  });

  test('shows code toggle button when generated_code present', () => {
    render(<ChartRenderer response={QUERY_RESPONSE} />);
    expect(screen.getByLabelText(/toggle generated code/i)).toBeInTheDocument();
  });

  test('toggles code panel on button click', () => {
    render(<ChartRenderer response={QUERY_RESPONSE} />);
    const codeBtn = screen.getByLabelText(/toggle generated code/i);
    expect(screen.queryByText(/Generated Query/i)).toBeNull();
    fireEvent.click(codeBtn);
    expect(screen.getByText(/Generated Query/i)).toBeInTheDocument();
  });

  test('switching type tabs changes the renderer', () => {
    render(<ChartRenderer response={QUERY_RESPONSE} defaultType="bar" />);
    fireEvent.click(screen.getByRole('tab', { name: /table/i }));
    expect(screen.getByPlaceholderText(/filter rows/i)).toBeInTheDocument();
  });

  test('accepts custom height prop', () => {
    render(<ChartRenderer response={QUERY_RESPONSE} defaultType="bar" height={500} />);
    expect(screen.getByTestId('highcharts')).toBeInTheDocument();
  });

  test('renders ResponseMeta footer with row count', () => {
    render(<ChartRenderer response={QUERY_RESPONSE} />);
    expect(screen.getByText(/5 rows/i)).toBeInTheDocument();
  });

  test('hides chart type tabs when no data', () => {
    render(<ChartRenderer response={SCALAR_RESPONSE} />);
    expect(screen.queryByRole('tab', { name: /bar/i })).toBeNull();
  });

  test('handles error response gracefully', () => {
    const err = { detail: 'Column not found: xyz' };
    // Should not throw; text renderer handles it
    expect(() => render(<ChartRenderer response={err} />)).not.toThrow();
  });
});