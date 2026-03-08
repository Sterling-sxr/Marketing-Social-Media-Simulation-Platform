import '@testing-library/jest-dom';
import React from 'react';

// expose React globally for classic JSX runtime
// @ts-ignore
globalThis.React = React;

// Mock WebSocket globally for tests needing it
class MockWebSocket {
  url: string;
  readyState = 0; // CONNECTING
  onopen: ((ev?: any) => any) | null = null;
  onmessage: ((ev: MessageEvent) => any) | null = null;
  onerror: ((ev?: any) => any) | null = null;
  onclose: ((ev?: any) => any) | null = null;
  constructor(url: string) {
    this.url = url;
    // simulate async open
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen && this.onopen({});
    }, 0);
  }
  send() {}
  close() {
    this.readyState = 3; // CLOSED
    this.onclose && this.onclose({});
  }
}

// @ts-ignore
globalThis.WebSocket = MockWebSocket as any;
