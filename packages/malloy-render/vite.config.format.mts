// The headless `@malloydata/render/format` entry: single-value formatters
// with no Solid, no Vega and no DOM, so a server or a sandboxed frame can
// format a value exactly as the renderer would without loading the renderer.
// Self-contained like the main build (`external: []`): `ssf` is CommonJS-only
// and `lodash/startCase` an extensionless subpath, and neither imports cleanly
// from Node's ESM loader when left external. Its .d.ts files come from the
// main build, which already emits dist/module/format/*.d.ts.
import {defineConfig} from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {'@': path.resolve(__dirname, './src')},
  },
  build: {
    outDir: 'dist/format',
    emptyOutDir: true,
    lib: {
      entry: 'src/format/index.ts',
      formats: ['es', 'cjs'],
      fileName: format => (format === 'es' ? 'index.mjs' : 'index.cjs'),
    },
    rollupOptions: {
      external: [],
    },
    sourcemap: process.env.NODE_ENV === 'development',
  },
});
