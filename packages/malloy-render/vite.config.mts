import {mergeConfig} from 'vite';
import baseViteConfig from './vite.config.base.mts';

export default mergeConfig(baseViteConfig, {
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'index',
      fileName: 'index',
    },
  },
});
