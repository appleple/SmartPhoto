import { defineConfig } from 'vite';

// 本番ビルド (lib/js) は tsup.config.ts が担当する。
// vite はここでは examples/ を確認するための開発用サーバー専用として使う
export default defineConfig({
  root: './',
  publicDir: 'examples/assets',
  server: {
    open: '/examples/index.html',
  },
});
