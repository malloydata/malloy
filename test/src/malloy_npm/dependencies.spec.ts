/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import madge from 'madge';

describe('dependencies', () => {
  function getMessage(circles: string[][]): string {
    let message = 'Circular References:\n';
    for (const circle of circles) {
      message += '    ';
      for (const dep of circle) {
        message += `${dep} -> `;
      }
      message += `${circle[0]}\n`;
    }
    return message;
  }

  it('typescript references should not be circular', async () => {
    const deps = await madge('packages', {
      fileExtensions: ['ts'],
      // This test targets *runtime* cycles. madge 8 follows `import type` edges
      // by default (madge 6 did not); those are erased by tsc and never form a
      // runtime cycle, so skip them or harmless type-only loops fail the check.
      detectiveOptions: {ts: {skipTypeImports: true}},
      excludeRegExp: [
        /malloy\/src\/lang/,
        /malloy-render\/src/,
        /\.d\.ts/,
        /malloy-interfaces\/generated-types/,
        /malloy-tag\/src\/lib/,
      ],
    });
    expect(deps.circular().length, getMessage(deps.circular())).toBe(0);
  });

  it('javascript references should not be circular', async () => {
    const deps = await madge('packages', {
      fileExtensions: ['js'],
      excludeRegExp: [/malloy-render\/dist/],
    });
    expect(deps.circular().length, getMessage(deps.circular())).toBe(0);
  });

  // Enable more strict circular checks if we refactor lang again.
  it.skip('malloy/src/lang typescript should not be circular', async () => {
    const deps = await madge('packages', {
      fileExtensions: ['ts'],
      excludeRegExp: [
        /malloy-render\/src/,
        /\.d\.ts/,
        /malloy-interfaces\/generated-types/,
        /malloy-tag\/src\/lib/,
      ],
    });
    expect(deps.circular().length, getMessage(deps.circular())).toBe(0);
  });

  // TODO: remove circular references in malloy-render
  it.skip('malloy-render/src typescript should not be circular', async () => {
    const deps = await madge('packages', {
      fileExtensions: ['ts'],
      excludeRegExp: [
        /malloy\/src\/lang/,
        /\.d\.ts/,
        /malloy-interfaces\/generated-types/,
        /malloy-tag\/src\/lib/,
      ],
    });
    expect(deps.circular().length, getMessage(deps.circular())).toBe(0);
  });

  // TODO: remove circular references in malloy-tag
  it.skip('malloy-tag/src typescript should not be circular', async () => {
    const deps = await madge('packages', {
      fileExtensions: ['ts'],
      excludeRegExp: [
        /malloy\/src\/lang/,
        /malloy-render\/src/,
        /\.d\.ts/,
        /malloy-interfaces\/generated-types/,
      ],
    });
    expect(deps.circular().length, getMessage(deps.circular())).toBe(0);
  });
});
