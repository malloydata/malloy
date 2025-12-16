/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Import this module to register Jest matchers (toMatchResult, toEqualResult).
 *
 * Usage in jest.config.js:
 *   setupFilesAfterEnv: ['@malloydata/malloy/test/matchers']
 *
 * Or import directly in a test file:
 *   import '@malloydata/malloy/test/matchers';
 */
import './resultMatchers';
