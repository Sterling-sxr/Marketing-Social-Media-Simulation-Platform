import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localNodeModules = path.resolve(__dirname, 'node_modules');
const frontendNodeModules = path.resolve(__dirname, '../../frontend/node_modules');
const stubsDir = path.resolve(__dirname, 'stubs');
const frontendSrcDir = path.resolve(__dirname, '../../frontend/src');

export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' })],
  resolve: {
    alias: {
      // all React packages point to tests/frontend-unit's node_modules
      react: path.resolve(localNodeModules, 'react'),
      'react-dom': path.resolve(localNodeModules, 'react-dom'),
      'react-dom/client': path.resolve(localNodeModules, 'react-dom', 'client'),
      'react-router-dom': path.resolve(localNodeModules, 'react-router-dom'),
      // Avoid loading the full icon library in unit tests (can stall bundling in CI).
      'lucide-react': path.resolve(stubsDir, 'lucide-react.js'),
      // Avoid loading the full charting library in unit tests.
      recharts: path.resolve(stubsDir, 'recharts.js'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./setup.ts'],
    globals: true,
    css: true,
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    sequence: {
      concurrent: false,
    },
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: 'istanbul',
      all: true,
      reportsDirectory: './coverage',
      reporter: ['text-summary', 'html', 'clover', 'json', 'json-summary'],
      // Note: use a root-relative glob here; Istanbul matching is more reliable than absolute paths.
      include: ['../../frontend/src/**/*.{js,jsx}'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/stubs/**',
        '**/*.test.*',
        '**/tests/**',
      ],
    },
  },
});
