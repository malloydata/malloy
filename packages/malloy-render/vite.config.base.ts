import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  optimizeDeps: {
    include: ['@malloydata/malloy'],
  },
  build: {
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
