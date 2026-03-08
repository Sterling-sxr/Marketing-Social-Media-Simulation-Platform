import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localNodeModules = path.resolve(__dirname, 'node_modules');

export default defineConfig({
  plugins: [react({ jsxRuntime: 'classic' })],
  resolve: {
    alias: {
      // all React packages point to tests/frontend-unit's node_modules
      react: path.resolve(localNodeModules, 'react'),
      'react-dom': path.resolve(localNodeModules, 'react-dom'),
      'react-dom/client': path.resolve(localNodeModules, 'react-dom', 'client'),
      'react-router-dom': path.resolve(localNodeModules, 'react-router-dom'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./setup.ts'],
    globals: true,
    css: true,
  },
});
