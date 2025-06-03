import type {PluginOption} from 'vite';
import {defineConfig} from 'vite';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [viteStripMalloyDevToolsPlugin(), solidPlugin()],
  optimizeDeps: {
    include: ['@malloydata/malloy'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      external: [],
      output: {},
    },
    commonjsOptions: {
      include: [/malloy/, /node_modules/],
    },
  },
  define: {
    'process.env': {},
  },
});

function viteStripMalloyDevToolsPlugin(): PluginOption {
  return {
    name: 'vite-plugin-strip-malloy-dev-tools',
    async transform(code, id) {
      if (id.endsWith('chart-dev-tool.tsx')) {
        return `
        export default function noop() {
          return null;
        }
        `;
      }
    },
  };
}
