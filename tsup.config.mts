import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const banner = `/*!
 * SmartPhoto v${pkg.version}
 * (c) ${pkg.author}
 * Released under the MIT License.
 */`;

export default defineConfig([
  // npm パッケージ用 (cjs/esm)。
  // dts: true (rollup-plugin-dts 経由の型生成) は現時点の TypeScript 7 系と
  // 非互換のため無効化し、型定義は `npm run build:types`(tsc --emitDeclarationOnly、
  // tsconfig.build.json)で lib/types/ に別途生成する
  {
    entry: { smartphoto: 'src/index.ts' },
    outDir: 'lib',
    format: ['cjs', 'esm'],
    target: 'es2020',
    clean: true,
    sourcemap: false,
    dts: false,
    // esbuild の cjs 出力は `export default` を `.default` に格納したままにするため、
    // require('smartphoto') がクラスをそのまま返すようアンラップする
    footer: (ctx) => (ctx.format === 'cjs' ? { js: 'module.exports = module.exports.default;' } : undefined),
  },
  // <script> タグ用グローバルビルド (window.SmartPhoto)
  {
    entry: { smartphoto: 'src/index.ts' },
    outDir: 'js',
    format: ['iife'],
    globalName: 'SmartPhoto',
    target: 'es2017',
    clean: false,
    minify: false,
    sourcemap: false,
    dts: false,
    banner: { js: banner },
    footer: { js: 'SmartPhoto = SmartPhoto.default;' },
    outExtension: () => ({ js: '.js' }),
  },
  {
    entry: { 'smartphoto.min': 'src/index.ts' },
    outDir: 'js',
    format: ['iife'],
    globalName: 'SmartPhoto',
    target: 'es2017',
    clean: false,
    minify: true,
    sourcemap: false,
    dts: false,
    banner: { js: banner },
    footer: { js: 'SmartPhoto = SmartPhoto.default;' },
    outExtension: () => ({ js: '.js' }),
  },
  // jQuery プラグイン。読み込まれた時点で window.jQuery(またはwindow.$)に
  // .SmartPhoto を副作用として登録するだけなので、グローバル変数の公開は不要
  {
    entry: { 'jquery-smartphoto': 'src/adaptor/jquery.ts' },
    outDir: 'js',
    format: ['iife'],
    target: 'es2017',
    clean: false,
    minify: false,
    sourcemap: false,
    dts: false,
    banner: { js: banner },
    outExtension: () => ({ js: '.js' }),
  },
  {
    entry: { 'jquery-smartphoto.min': 'src/adaptor/jquery.ts' },
    outDir: 'js',
    format: ['iife'],
    target: 'es2017',
    clean: false,
    minify: true,
    sourcemap: false,
    dts: false,
    banner: { js: banner },
    outExtension: () => ({ js: '.js' }),
  },
]);
