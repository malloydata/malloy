import {mergeConfig} from 'vite';
import baseViteConfig from './vite.config.base.mts';

// Peer deps that consumers of the ESM build resolve from their own
// node_modules (enabling dedupe and tree-shaking). The UMD build keeps
// everything inlined for script-tag and Node (require) consumers.
//
// This ESM artifact is bundler-only: it contains subpath imports
// (e.g. lodash/startCase) and JSON imports (e.g. us-atlas/states-10m.json)
// that a bundler resolves transparently but that Node's native ESM
// resolver does not. Node consumers without a bundler should use the
// `require` condition in package.json `exports`, which resolves to UMD.
const external: (string | RegExp)[] = [
  /^solid-js(\/.*)?$/,
  /^lodash(\/.*)?$/,
  /^luxon(\/.*)?$/,
  /^ssf$/,
  /^us-atlas(\/.*)?$/,
  /^@tanstack\/solid-virtual$/,
  /^@malloydata\/malloy-interfaces(\/.*)?$/,
  /^@malloydata\/malloy-tag(\/.*)?$/,
  /^vega(\/.*)?$/,
  /^vega-[a-z-]+(\/.*)?$/,
  /^d3-[a-z-]+(\/.*)?$/,
];

export default mergeConfig(baseViteConfig, {
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external,
    },
  },
});
