import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    globals: true,
    testTimeout: 30000, // タイムアウトを30秒に延長
    hookTimeout: 30000, // フックのタイムアウトも延長
  },
});
