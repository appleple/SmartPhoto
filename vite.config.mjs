import { resolve } from 'path';
import { defineConfig } from 'vite';

const configs = {
  // libビルド用の設定
  lib: defineConfig({
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        name: 'SmartPhoto',
        fileName: 'smartphoto',
        formats: ['es', 'cjs'],
      },
      outDir: 'lib',
      minify: false,
      rollupOptions: {
        external: ['jquery'],
        output: {
          preserveModules: false,
        },
      },
      emptyOutDir: false,
    },
  }),
  // UMDビルド用の設定
  umd: defineConfig({
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        name: 'SmartPhoto',
        fileName: (format) => `smartphoto.${format === 'es' ? 'js' : 'min.js'}`,
        formats: ['umd', 'es'],
      },
      outDir: 'js',
      minify: false,
      rollupOptions: {
        external: ['jquery'],
        output: {
          globals: {
            jquery: '$',
          },
        },
      },
      emptyOutDir: false,
    },
  }),
  // jQueryプラグイン用の設定
  jquery: defineConfig({
    build: {
      lib: {
        entry: resolve(__dirname, 'src/adaptor/jquery.js'),
        name: 'SmartPhoto',
        fileName: (format) => `jquery-smartphoto.${format === 'es' ? 'js' : 'min.js'}`,
        formats: ['umd', 'es'],
      },
      outDir: 'js',
      minify: false,
      rollupOptions: {
        external: ['jquery'],
        output: {
          globals: {
            jquery: '$',
          },
        },
      },
      emptyOutDir: false,
    },
  }),
};

export default defineConfig(({ mode }) => {
  return configs[mode] || configs.umd;
});
