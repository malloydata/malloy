/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Injected by esbuild in place of every free `process` reference in the
 * bundle (see `inject` in build.js), so the bundle never needs, or defines, a
 * global `process`. The only reader that matters is the `assert` polyfill
 * that antlr4ts pulls in, through `util`, which looks at `process.env` when
 * it loads.
 */
export const process = {
  env: {} as Record<string, string | undefined>,
  browser: true,
  version: '',
  versions: {} as Record<string, string>,
  platform: 'embedded',
  // Runs the callback now, not on a later tick: enough for the assert
  // polyfill, the only reader, but not a real nextTick.
  nextTick(fn: (...args: unknown[]) => void, ...args: unknown[]): void {
    fn(...args);
  },
};
