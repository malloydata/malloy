import {mergeConfig} from 'vite';
import baseViteConfig from './vite.config.base';

export default mergeConfig(baseViteConfig, {
  build: {
    lib: {
      entry: 'src/component/render-webcomponent.ts',
      name: 'malloy-render',
      fileName: 'malloy-render',
    },
  },
});
