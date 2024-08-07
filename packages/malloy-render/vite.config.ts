// eslint-disable-next-line node/no-unpublished-import
import {defineConfig} from 'vite';
// eslint-disable-next-line node/no-unpublished-import
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  optimizeDeps: {
    include: ['@malloydata/malloy'],
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'index',
      fileName: 'index',
    },
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
