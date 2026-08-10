import { defineConfig, devices } from '@playwright/test';

// jsdom ベースの契約/単体テスト(vitest)ではレイアウト計算(getBoundingClientRect)や
// 実ポインタキャプチャが再現できず、実際に li-transform の欠落バグを見逃した経緯がある。
// 本ファイルはその穴を埋めるため、実 Chromium 上でスワイプ/開閉/データソースモードを
// 検証する E2E テストの設定
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI では list に加えて github(PRへの注釈)と html(失敗時にアーティファクトとして
  // アップロードするレポート)を有効にする
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: './node_modules/.bin/vite --port 4174 --strictPort',
    url: 'http://localhost:4174/examples/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
