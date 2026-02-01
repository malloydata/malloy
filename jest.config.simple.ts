/**
 * Simplified Jest config for use with vscode-jest-runner extension.
 * The main jest.config.ts uses `projects` which the extension doesn't support.
 * This config is used by jestrunner.configPath mapping in .vscode/settings.json.
 */

import type {Config} from 'jest';

process.env.TZ = 'America/Los_Angeles';

const transformIgnoreModules = ['@motherduck/wasm-client'].join('|');

const config: Config = {
  preset: 'ts-jest',
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
};

module.exports = config;
