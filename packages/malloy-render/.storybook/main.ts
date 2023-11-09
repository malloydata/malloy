import {join, dirname} from 'path';
import {mergeConfig, InlineConfig} from 'vite';
import {StorybookConfig} from '@storybook/html-vite';

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, 'package.json')));
}

const config: StorybookConfig = {
  'stories': ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  staticDirs: ['../src/stories/static'],
  'addons': [
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-interactions'),
  ],
  'framework': {
    'name': '@storybook/html-vite',
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
    const configOverride: InlineConfig = {
      resolve: {
        preserveSymlinks: true,
        alias: {
          '@malloydata/malloy': join(__dirname, '../../malloy/src'),
          '@malloydata/db-duckdb/wasm': join(
            __dirname,
            '../../malloy-db-duckdb/src/duckdb_wasm_connection_browser'
          ),
        },
      },
      server: {
        // Disable HMR for now, as we can't seem to get malloy core nor Lit to fully support it
        hmr: false,
      },
      define: {
        'process.env': {},
      },
    };
    const finalConfig = mergeConfig(config, configOverride);
    return finalConfig;
  },
};
export default config;
