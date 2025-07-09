/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import type {Config} from 'jest';

process.env.TZ = 'America/Los_Angeles';

const transformIgnoreModules = ['@motherduck/wasm-client'].join('|');

const defaultConfig: Config = {
  preset: 'ts-jest',
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts', 'jest-expect-message'],
  testMatch: ['<rootDir>**/*.spec.(ts|js)?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/out/'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {tsconfig: '<rootDir>/test/tsconfig.json'}],
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
        '<rootDir>/test/src/render/',
      ],
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
      displayName: 'db-sqlserver',
      roots: ['<rootDir>/packages/malloy-db-sqlserver/'],
    },
  ],
};

module.exports = config;
