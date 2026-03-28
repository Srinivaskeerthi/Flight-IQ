/**
 * src/__tests__/
 * Tests for useQueryChat hook and chartUtils helpers.
 * Run with: npm test
 */

// ─── chartUtils.test.js ───────────────────────────────────────────────────────

import {
  buildBarConfig,
  buildLineConfig,
  buildPieConfig,
  buildChartConfig,
} from '../utils/chartUtils';

const SAMPLE_DATA = [
  { airline_name: 'American Airline', avg_fare: 523.4 },
  { airline_name: 'Delta Air Lines',  avg_fare: 612.1 },
  { airline_name: 'JetBlue Airways',  avg_fare: 389.8 },
];

// ── buildBarConfig ─────────────────────────────────────────────────────────

describe('buildBarConfig', () => {
  it('returns a config object with chart type "bar"', () => {
    const cfg = buildBarConfig(SAMPLE_DATA, 'Avg Fare');
    expect(cfg).not.toBeNull();
    expect(cfg.chart.type).toBe('bar');
  });

  it('uses the string column as categories', () => {
    const cfg = buildBarConfig(SAMPLE_DATA);
    expect(cfg.xAxis.categories).toEqual([
      'American Airline',
      'Delta Air Lines',
      'JetBlue Airways',
    ]);
  });

  it('uses the numeric column as series data', () => {
    const cfg = buildBarConfig(SAMPLE_DATA);
    expect(cfg.series[0].data).toEqual([523.4, 612.1, 389.8]);
  });

  it('returns null for empty data', () => {
    expect(buildBarConfig([])).toBeNull();
  });
});

// ── buildLineConfig ────────────────────────────────────────────────────────

describe('buildLineConfig', () => {
  it('returns chart type "line"', () => {
    const cfg = buildLineConfig(SAMPLE_DATA);
    expect(cfg.chart.type).toBe('line');
  });

  it('maps numeric values to series data', () => {
    const cfg = buildLineConfig(SAMPLE_DATA);
    expect(cfg.series[0].data).toHaveLength(3);
    expect(cfg.series[0].data[1]).toBe(612.1);
  });

  it('returns null for empty data', () => {
    expect(buildLineConfig([])).toBeNull();
  });
});

// ── buildPieConfig ─────────────────────────────────────────────────────────

describe('buildPieConfig', () => {
  it('returns chart type "pie"', () => {
    const cfg = buildPieConfig(SAMPLE_DATA);
    expect(cfg.chart.type).toBe('pie');
  });

  it('produces pie slice objects with name and y', () => {
    const cfg = buildPieConfig(SAMPLE_DATA);
    const slices = cfg.series[0].data;
    expect(slices[0]).toMatchObject({ name: 'American Airline', y: 523.4 });
    expect(slices[2]).toMatchObject({ name: 'JetBlue Airways',  y: 389.8 });
  });

  it('assigns unique colors to each slice', () => {
    const cfg = buildPieConfig(SAMPLE_DATA);
    const colors = cfg.series[0].data.map(s => s.color);
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBe(colors.length);
  });

  it('returns null for empty data', () => {
    expect(buildPieConfig([])).toBeNull();
  });
});

// ── buildChartConfig dispatcher ────────────────────────────────────────────

describe('buildChartConfig', () => {
  it('dispatches to bar config', () => {
    const cfg = buildChartConfig('bar', SAMPLE_DATA, 'Q?');
    expect(cfg.chart.type).toBe('bar');
  });

  it('dispatches to line config', () => {
    const cfg = buildChartConfig('line', SAMPLE_DATA, 'Q?');
    expect(cfg.chart.type).toBe('line');
  });

  it('dispatches to pie config', () => {
    const cfg = buildChartConfig('pie', SAMPLE_DATA, 'Q?');
    expect(cfg.chart.type).toBe('pie');
  });

  it('returns null for table type', () => {
    expect(buildChartConfig('table', SAMPLE_DATA, 'Q?')).toBeNull();
  });

  it('returns null when data is empty', () => {
    expect(buildChartConfig('bar', [], 'Q?')).toBeNull();
  });

  it('truncates long questions in the chart title', () => {
    const longQ = 'A'.repeat(80);
    const cfg = buildChartConfig('bar', SAMPLE_DATA, longQ);
    expect(cfg.title.text.length).toBeLessThanOrEqual(60);
    expect(cfg.title.text.endsWith('…')).toBe(true);
  });
});

// ─── useQueryChat.test.js ─────────────────────────────────────────────────────

import { renderHook, act } from '@testing-library/react';
import axios from 'axios';
import { useQueryChat, CHART_TYPES } from '../hooks/useQueryChat';

jest.mock('axios');

const MOCK_RESPONSE = {
  data: {
    question:        'Which airline has the highest average fare?',
    generated_code:  "result = df.groupby('airline_name')['fare'].mean()",
    data:            SAMPLE_DATA,
    columns:         ['airline_name', 'avg_fare'],
    row_count:       3,
    interpretation:  'Delta Air Lines has the highest average fare at $612.',
  },
};

beforeEach(() => jest.clearAllMocks());

describe('useQueryChat', () => {
  it('initialises with empty messages', () => {
    const { result } = renderHook(() => useQueryChat());
    expect(result.current.messages).toHaveLength(0);
  });

  it('exposes CHART_TYPES constant', () => {
    expect(CHART_TYPES).toContain('bar');
    expect(CHART_TYPES).toContain('pie');
    expect(CHART_TYPES).toContain('line');
    expect(CHART_TYPES).toContain('table');
  });

  it('adds user message immediately on sendQuestion', async () => {
    axios.create.mockReturnValue({ post: jest.fn().mockResolvedValue(MOCK_RESPONSE) });
    const { result } = renderHook(() => useQueryChat());

    await act(async () => {
      await result.current.sendQuestion('Which airline is most popular?');
    });

    const userMsgs = result.current.messages.filter(m => m.role === 'user');
    expect(userMsgs).toHaveLength(1);
    expect(userMsgs[0].text).toBe('Which airline is most popular?');
  });

  it('adds assistant message after successful API response', async () => {
    axios.create.mockReturnValue({ post: jest.fn().mockResolvedValue(MOCK_RESPONSE) });
    const { result } = renderHook(() => useQueryChat());

    await act(async () => {
      await result.current.sendQuestion('avg fare per airline');
    });

    const asstMsgs = result.current.messages.filter(m => m.role === 'assistant');
    expect(asstMsgs).toHaveLength(1);
    expect(asstMsgs[0].queryResult.row_count).toBe(3);
  });

  it('adds error message on API failure', async () => {
    axios.create.mockReturnValue({
      post: jest.fn().mockRejectedValue({ message: 'Network Error', isAxiosError: true }),
    });
    // isCancel returns false for regular errors
    axios.isCancel = jest.fn(() => false);

    const { result } = renderHook(() => useQueryChat());

    await act(async () => {
      await result.current.sendQuestion('bad question');
    });

    const errMsgs = result.current.messages.filter(m => m.role === 'error');
    expect(errMsgs).toHaveLength(1);
  });

  it('clears messages on clearChat', async () => {
    axios.create.mockReturnValue({ post: jest.fn().mockResolvedValue(MOCK_RESPONSE) });
    const { result } = renderHook(() => useQueryChat());

    await act(async () => {
      await result.current.sendQuestion('test');
    });

    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => result.current.clearChat());
    expect(result.current.messages).toHaveLength(0);
  });

  it('does not send empty questions', async () => {
    const mockPost = jest.fn();
    axios.create.mockReturnValue({ post: mockPost });
    const { result } = renderHook(() => useQueryChat());

    await act(async () => {
      await result.current.sendQuestion('   ');
    });

    expect(mockPost).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it('isLoading is false after request completes', async () => {
    axios.create.mockReturnValue({ post: jest.fn().mockResolvedValue(MOCK_RESPONSE) });
    const { result } = renderHook(() => useQueryChat());

    await act(async () => {
      await result.current.sendQuestion('test question');
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('setInput updates the input value', () => {
    const { result } = renderHook(() => useQueryChat());
    act(() => result.current.setInput('hello world'));
    expect(result.current.input).toBe('hello world');
  });

  it('setChartType updates chartType', () => {
    const { result } = renderHook(() => useQueryChat());
    act(() => result.current.setChartType('pie'));
    expect(result.current.chartType).toBe('pie');
  });
});