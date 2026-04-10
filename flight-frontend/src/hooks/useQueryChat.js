/**
 * useQueryChat.js
 * Custom hook that manages the full chat + query lifecycle:
 *   - message history
 *   - sending questions to POST /query via Axios
 *   - chart-type selection (uses API response chart field)
 *   - loading / error state
 */

import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '';

const axiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 120_000,
  headers: { 'Content-Type': 'application/json' },
});

export const CHART_TYPES = ['bar', 'line', 'pie', 'table'];

/**
 * Fallback chart type inference from question keywords and data shape.
 * Only used when API does not return a chart field.
 */
function inferChartType(question = '', data = [], columns = []) {
  if (!data || data.length === 0) return 'table';
  if (!columns || columns.length === 0) return 'table';

  const q = question.toLowerCase();

  // Time series keywords → line
  if (['trend', 'monthly', 'over time', 'by month', 'by year', 'daily', 'weekly'].some(w => q.includes(w)))
    return 'line';

  // Distribution / share keywords → pie
  if (['distribution', 'share', 'proportion', 'percentage', 'breakdown', 'split'].some(w => q.includes(w)))
    return data.length <= 10 ? 'pie' : 'bar';

  // Status / category keywords → pie
  if (['confirmed', 'pending', 'cancelled', 'status'].some(w => q.includes(w)))
    return 'pie';

  // Class keywords → pie
  if (['class', 'economy', 'business', 'first'].some(w => q.includes(w)) && data.length <= 5)
    return 'pie';

  // Single column → table
  if (columns.length === 1) return 'table';

  // Many rows or many columns → table
  if (data.length > 20 || columns.length > 4) return 'table';

  // 2-3 columns → bar
  if (columns.length <= 3) return 'bar';

  return 'table';
}

export function useQueryChat() {
  const [messages,   setMessages ] = useState([]);
  const [input,      setInput    ] = useState('');
  const [isLoading,  setIsLoading] = useState(false);
  const [chartType,  setChartType] = useState('bar');
  const [apiKey,     setApiKey   ] = useState('');
  const abortRef                   = useRef(null);

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), ...msg }]);
  }, []);

  const sendQuestion = useCallback(async (question) => {
    if (!question.trim() || isLoading) return;

    addMessage({ role: 'user', text: question });
    setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload = {
        question,
        interpret: true,
        ...(apiKey ? { openai_api_key: apiKey } : {}),
      };

      const { data } = await axiosInstance.post('/query', payload, {
        signal: controller.signal,
      });

      const hasData    = Array.isArray(data.data) && data.data.length > 0;
      const apiColumns = data.columns || [];

      // ✅ Priority 1: use chart type from API (set by detect_chart_type in backend)
      // ✅ Priority 2: fallback to frontend inference
      const chartFromApi  = data.chart;
      const chartFallback = hasData
        ? inferChartType(question, data.data, apiColumns)
        : 'table';

      const resolvedChart = chartFromApi || chartFallback;

      setChartType(resolvedChart);

      addMessage({
        role:        'assistant',
        text:        data.text || 'Here are the results.',
        queryResult: {
          data:           data.data           || [],
          columns:        apiColumns,
          row_count:      data.row_count      || data.data?.length || 0,
          generated_code: data.generated_code || null,
          interpretation: data.text           || '',
          question:       question,
        },
        chartType: resolvedChart,
      });

    } catch (err) {
      if (axios.isCancel(err)) return;
      const detail = err.response?.data?.detail || err.message || 'Unknown error.';
      addMessage({ role: 'error', text: `Error: ${detail}` });
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [isLoading, apiKey, addMessage]);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    input,      setInput,
    isLoading,
    chartType,  setChartType,
    apiKey,     setApiKey,
    sendQuestion,
    cancelRequest,
    clearChat,
  };
}