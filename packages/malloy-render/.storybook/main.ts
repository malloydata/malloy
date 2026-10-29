import {join, dirname} from 'path';
import type {InlineConfig} from 'vite';
import {mergeConfig} from 'vite';
import type {StorybookConfig} from '@storybook/html-vite';
import {
  malloyStoriesIndexer,
  viteMalloyStoriesPlugin,
} from './malloy-stories-indexer';

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, 'package.json')));
}

const config: StorybookConfig = {
  'stories': [
    '../src/stories/*.mdx',
    '../src/**/*.stories.malloy',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  'experimental_indexers': async existingIndexers => [
    ...(existingIndexers ?? []),
    malloyStoriesIndexer,
  ],
  'staticDirs': ['../src/stories/static'],
  'addons': [
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-interactions'),
  ],
  'core': {
    builder: '@storybook/builder-vite',
    disableTelemetry: true,
  },
  'framework': {
    'name': '@storybook/html-vite',
    'options': {},
  },
  'docs': {},
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
      // Pre-bundle heavy WASM/Arrow deps that Vite's scanner misses in
      // the monorepo (linked packages aren't crawled for deep imports).
      // Without this, Storybook throws "module not found" on first load.
      // @motherduck/wasm-client must be excluded because it ships its own
      // WASM loader that breaks under Vite's esbuild pre-bundling.
      optimizeDeps: {
        include: [
          '@duckdb/duckdb-wasm',
          'web-worker',
          'apache-arrow',
          '@storybook/theming/create',
        ],
        exclude: ['@motherduck/wasm-client'],
      },
      server: {
        // Disable HMR for now, as we can't seem to get malloy core nor web component to fully support it
        hmr: false,
      },
      define: {
        'process.env': {
          'IS_STORYBOOK': true,
        },
      },
      assetsInclude: ['/sb-preview/runtime.js'],
      plugins: [viteMalloyStoriesPlugin()],
    };
    const finalConfig = mergeConfig(config, configOverride);
    // Filter out dev tools plugin
    finalConfig.plugins = finalConfig.plugins.filter(
      plugin => plugin.name !== 'vite-plugin-strip-malloy-dev-tools'
    );
    return finalConfig;
  },
};
export default config;
