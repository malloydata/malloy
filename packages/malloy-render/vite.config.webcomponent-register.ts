import {mergeConfig} from 'vite';
import baseViteConfig from './vite.config.base';

export default mergeConfig(baseViteConfig, {
  build: {
    lib: {
      entry: 'src/component/register-webcomponent.ts',
      name: 'register',
      fileName: 'register',
    },
  },
});
