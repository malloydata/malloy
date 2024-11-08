import {defineConfig} from 'vite';
import solidPlugin from 'vite-plugin-solid';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  plugins: [solidPlugin()],
  optimizeDeps: {
    include: ['@malloydata/malloy'],
  },
  build: {
    lib: {
      entry: 'src/component/render-webcomponent.ts',
      name: 'malloy-render',
      fileName: 'malloy-render',
    },
    rollupOptions: {
      external: [
        fileURLToPath(
          new URL('src/component/chart/chart-dev-tool.tsx', import.meta.url)
        ),
      ],
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
