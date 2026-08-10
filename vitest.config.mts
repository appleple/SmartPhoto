import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    testTimeout: 30000, // タイムアウトを30秒に延長
    hookTimeout: 30000, // フックのタイムアウトも延長
    // test/e2e は Playwright 専用(playwright.config.mts で実行)なので対象外にする
    exclude: [...configDefaults.exclude, 'test/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/index.js', 'src/index.ts', 'src/core/types.ts'],
    },
  },
});
