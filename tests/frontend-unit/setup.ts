import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { afterAll, afterEach, beforeEach, vi } from 'vitest';

// expose React globally for classic JSX runtime
// @ts-ignore
globalThis.React = React;

// Mock WebSocket globally for tests needing it
class MockWebSocket {
  url: string;
  readyState = 1; // OPEN
  onopen: ((ev?: any) => any) | null = null;
  onmessage: ((ev: MessageEvent) => any) | null = null;
  onerror: ((ev?: any) => any) | null = null;
  onclose: ((ev?: any) => any) | null = null;
  constructor(url: string) {
    this.url = url;
  }
  send() {}
  close() {
    this.readyState = 3; // CLOSED
    this.onclose && this.onclose({});
  }
}

// @ts-ignore
globalThis.WebSocket = MockWebSocket as any;

const originalConsoleLog = console.log;
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  console.log = originalConsoleLog;
});

const stubComponent = ({ children, ...props }: any) =>
  React.createElement('div', props, children);

vi.mock(
  'lucide-react',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_, key) => {
          if (key === '__esModule') return true;
          return stubComponent;
        },
      }
    ),
  { virtual: true }
);

vi.mock(
  'recharts',
  () =>
    new Proxy(
      { __esModule: true },
      {
        get: (_, key) => {
          if (key === '__esModule') return true;
          return stubComponent;
        },
      }
    ),
  { virtual: true }
);

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
