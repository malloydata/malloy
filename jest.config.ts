import type {Config} from 'jest';

process.env['TZ'] = 'America/Los_Angeles';

// ESM-only deps that ship plain static import/export: jest's CJS runtime can't
// load them as-is, so they must be transformed (not ignored). See the Class-1
// ESM note in .github/dependabot-pins.md.
const transformIgnoreModules = [
  '@motherduck/wasm-client',
  '@noble/hashes',
].join('|');

const defaultConfig: Config = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts', 'jest-expect-message'],
  testMatch: ['<rootDir>**/*.spec.(ts|js)?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/out/'],
  // node_modules is left untransformed except the Class-1 ESM-only deps above,
  // which must be run through babel to become loadable under jest's CJS runtime.
  transformIgnorePatterns: [`node_modules/(?!(${transformIgnoreModules})/)`],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {tsconfig: '<rootDir>/test/tsconfig.json'}],
    '^.+\\.(js|jsx)$': [
      'babel-jest',
      {
        'presets': ['@babel/preset-env'],
        'plugins': [['@babel/transform-runtime']],
      },
    ],
  },
};

const config: Config = {
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts', 'jest-expect-message'],
  testMatch: ['**/?(*.)spec.(ts|js)?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/out/'],
  transformIgnorePatterns: [`node_modules/(?!(${transformIgnoreModules})/)`],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {tsconfig: '<rootDir>/test/tsconfig.json'}],
    '^.+\\.(js|jsx)$': [
      'babel-jest',
      {
        'presets': ['@babel/preset-env'],
        'plugins': [['@babel/transform-runtime']],
      },
    ],
  },
  testTimeout: 100000,
  verbose: true,
  testEnvironment: 'node',
  projects: [
    {
      ...defaultConfig,
      displayName: 'malloy-core',
      roots: [
        '<rootDir>/packages/malloy/',
        '<rootDir>/packages/malloy-filter/',
        '<rootDir>/packages/malloy-interfaces/',
        '<rootDir>/packages/malloy-malloy-sql/',
        '<rootDir>/packages/malloy-syntax-highlight/',
        '<rootDir>/packages/malloy-tag/',
        '<rootDir>/packages/malloy/',
        '<rootDir>/packages/malloy-query-builder/',
        '<rootDir>/test/src/core/',
      ],
    },
    {
      // The render tests need a DOM (jest.setup.dom.ts). They are kept in
      // their own project so the fake `document` global is not in scope for
      // the duckdb-wasm tests in malloy-core — web-worker's browser detection
      // keys off `typeof document` and breaks under Node when it is present.
      ...defaultConfig,
      displayName: 'malloy-render-test',
      setupFilesAfterEnv: [
        '<rootDir>/test/jest.setup.dom.ts',
        ...(defaultConfig.setupFilesAfterEnv ?? []),
      ],
      roots: ['<rootDir>/test/src/render/'],
    },
    {
      ...defaultConfig,
      displayName: 'malloy-render',
      rootDir: '<rootDir>/packages/malloy-render',
      testMatch: ['<rootDir>/src/**/*.spec.(ts|js)?(x)'],
      setupFilesAfterEnv: [],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transform: {
        '^.+\\.(ts|tsx)$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.json',
          },
        ],
        '^.+\\.(js|jsx)$': [
          'babel-jest',
          {
            'presets': ['@babel/preset-env'],
            'plugins': [['@babel/transform-runtime']],
          },
        ],
      },
    },
    {
      ...defaultConfig,
      displayName: 'db-all',
      roots: ['<rootDir>/test/src/databases/all/'],
    },
    {
      ...defaultConfig,
      displayName: 'db-bigquery',
      roots: [
        '<rootDir>/packages/malloy-db-bigquery/',
        '<rootDir>/test/src/databases/bigquery/',
      ],
    },
    {
      ...defaultConfig,
      displayName: 'db-duckdb',
      roots: [
        '<rootDir>/packages/malloy-db-duckdb/',
        '<rootDir>/test/src/databases/duckdb-all/',
      ],
    },
    {
      ...defaultConfig,
      displayName: 'db-duckdb-core',
      roots: ['<rootDir>/test/src/databases/duckdb/'],
    },
    {
      ...defaultConfig,
      displayName: 'db-postgres',
      roots: [
        '<rootDir>/packages/malloy-db-postgres/',
        '<rootDir>/test/src/databases/postgres/',
      ],
    },
    {
      ...defaultConfig,
      displayName: 'db-presto-trino',
      roots: [
        '<rootDir>/packages/malloy-db-trino/src/',
        '<rootDir>/test/src/databases/presto-trino/',
      ],
    },
    {
      ...defaultConfig,
      displayName: 'db-publisher',
      roots: ['<rootDir>/packages/malloy-db-publisher/'],
    },
    {
      ...defaultConfig,
      displayName: 'db-snowflake',
      roots: ['<rootDir>/packages/malloy-db-snowflake/'],
    },
    {
      ...defaultConfig,
      displayName: 'db-mysql',
      roots: ['<rootDir>/packages/malloy-db-mysql/'],
    },
    {
      ...defaultConfig,
      displayName: 'db-databricks',
      roots: ['<rootDir>/packages/malloy-db-databricks/'],
    },
  ],
};

module.exports = config;
