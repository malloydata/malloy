import {defineConfig} from 'vite';
import solidPlugin from 'vite-plugin-solid';

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
