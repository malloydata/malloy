import {join, dirname} from 'path';
import {mergeConfig} from 'vite';

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, 'package.json')));
}

/** @type { import('@storybook/html-vite').StorybookConfig } */
const config = {
  'stories': ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  staticDirs: ['../src/stories/static'],
  'addons': [
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-interactions'),
  ],
  'framework': {
    'name': getAbsolutePath('@storybook/html-vite'),
    'options': {},
  },
  'docs': {
    'autodocs': 'tag',
  },
  async viteFinal(config, {configType}) {
    if (configType === 'DEVELOPMENT') {
      // Your development configuration goes here
    }
    if (configType === 'PRODUCTION') {
      // Your production configuration goes here.
    }
    const finalConfig = mergeConfig(config, {
      resolve: {
        preserveSymlinks: true,
      },
      define: {
        'process.env': {},
      },
    });
    return finalConfig;
  },
};
export default config;
