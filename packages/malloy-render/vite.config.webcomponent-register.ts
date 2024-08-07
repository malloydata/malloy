import {defineConfig} from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  optimizeDeps: {
    include: ['@malloydata/malloy'],
  },
  build: {
    lib: {
      entry: 'src/component/register-webcomponent.ts',
      name: 'register',
      fileName: 'register',
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
