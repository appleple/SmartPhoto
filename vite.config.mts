import { defineConfig } from 'vite';

// 本番ビルド (lib/js) は tsup.config.ts が担当する。
// vite はここでは examples/ を確認するための開発用サーバー専用として使う
export default defineConfig({
  root: './',
  publicDir: 'examples/assets',
  server: {
    open: '/examples/index.html',
    // 0.0.0.0 にバインドし、同一Wi-Fi/LAN内の実機からも
    // `npm run dev` 起動時に表示される Network の URL でアクセスできるようにする
    host: true,
  },
});
