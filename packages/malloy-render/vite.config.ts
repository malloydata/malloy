import {mergeConfig} from 'vite';
import baseViteConfig from './vite.config.base';

export default mergeConfig(baseViteConfig, {
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'index',
      fileName: 'index',
    },
  },
});
