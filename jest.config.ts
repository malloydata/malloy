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

process.env.TZ = 'America/Los_Angeles';

const transformIgnoreModules = [
  'lit-html',
  'lit-element',
  'lit',
  '@lit',
  '@lit-labs',
  '@motherduck/wasm-client',
].join('|');

module.exports = {
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
  // moduleNameMapper: {
  //   // For your sub-package that uses "@/":
  //   // This regex captures everything after "@/", and the replacement maps it to
  //   // the correct source directory within the sub-package relative to the root.
  //   '^@/(.*)$': '<rootDir>/packages/malloy-render/src/$1',

  //   // If you have other sub-packages with different aliases, add them here:
  //   // '^@another-package/(.*)$': '<rootDir>/packages/another-package/src/$1',
  // },
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
      displayName: 'malloy-render',
      // testMatch: ['<rootDir>/packages/malloy-render/**/*.spec.ts'],
      rootDir: '<rootDir>/packages/malloy-render', // The root for this specific project
      preset: 'ts-jest', // Use ts-jest for TypeScript files
      testMatch: ['<rootDir>/src/**/*.spec.(ts|js)?(x)'], // Only test files within this package's src
      globals: {
        'ts-jest': {
          // Tell ts-jest to use the tsconfig specific to malloy-render
          tsconfig: '<rootDir>/tsconfig.json', // Relative to this project's rootDir
        },
      },
      // moduleNameMapper for this project's specific aliases
      moduleNameMapper: {
        // Here, '@/ refers to the src folder relative to this project's rootDir
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest', // Only need to specify 'ts-jest' here as tsconfig is in globals
        '^.+\\.(js|jsx)$': [
          'babel-jest',
          {
            'presets': ['@babel/preset-env'],
            'plugins': [['@babel/transform-runtime']],
          },
        ],
      },
    },
  ],
};
