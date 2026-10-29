/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Config} from 'jest';

/*
 * A deliberately *plain* ts-jest config — the point of the consumer-contract
 * canary. A downstream consumer's jest leaves node_modules untransformed, so an
 * ESM-only published runtime dependency throws "Cannot use import statement
 * outside a module" when the consumer loads it — exactly as the VS Code extension
 * did on `uuid` v14.
 *
 * Do NOT add `transformIgnorePatterns` / babel-jest here to "fix" a failure. The
 * repo's own jest.config.ts does that, which is precisely why malloy's tests stay
 * green while consumers break. Adding it here would hide the leak this canary
 * exists to catch. A red canary means a runtime dep went ESM-only — pin it (see
 * docs/dependency-management/CONTEXT.md), don't transform it away.
 */
const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {tsconfig: '<rootDir>/../tsconfig.json'}],
  },
};

export default config;
