import {mergeConfig} from 'vite';
import baseViteConfig from './vite.config.base.mts';

// UMD build inlines every dependency so the artifact works as a
// self-contained script-tag embed and as a CJS require target. Do not
// externalize anything here — that is the ESM build's job.
export default mergeConfig(baseViteConfig, {
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'src/index.ts',
      name: 'index',
      formats: ['umd'],
      fileName: 'index',
    },
  },
});
