'use strict';

const gtsConfig = require('gts/build/eslint.config');
const {defineConfig} = require('eslint/config');
const globals = require('globals');

module.exports = defineConfig([
  {
    ignores: [
      '**/*.d.ts',
      'packages/malloy/src/lang/lib/Malloy/**',
      'packages/**/dist/**',
      'profiler/dist/**',
      'packages/malloy-malloy-sql/src/grammar/**',
      'packages/malloy-tag/src/peggy/dist/**',
      'packages/malloy-syntax-highlight/**/*.monarch.ts',
      'packages/malloy-interfaces/docs/**',
      'packages/malloy-query-builder/docs/**',
      'packages/malloy-tag/src/lib/**',
      'packages/malloy-filter/src/lib/**',
      'packages/malloy-render/storybook-static/**',
      '.claude/**',
      '**/*.mts',
      '**/*.cts',
    ],
  },
  ...gtsConfig,
  {
    rules: {
      'no-console': 'warn',
      'prettier/prettier': ['error', {quoteProps: 'preserve'}],
      'no-duplicate-imports': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@malloydata/malloy/src/*'],
          paths: [
            {
              name: 'lodash',
              message: 'Import [module] from lodash/[module] instead',
            },
          ],
        },
      ],
      'no-throw-literal': 'error',
      'quote-props': ['error', 'consistent'],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
    rules: {
      'no-undef': 'off',
      'no-duplicate-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {prefer: 'type-imports'},
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/parameter-properties': [
        'error',
        {prefer: 'parameter-property'},
      ],
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },
  {
    files: ['scripts/**', 'packages/malloy-render/src/stories/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/vite.config.*', 'scripts/**'],
    rules: {
      'n/no-unpublished-import': 'off',
    },
  },
]);
