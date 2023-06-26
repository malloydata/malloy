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
      excludeRegExp: [/malloy\/src\/lang/, /\.d\.ts/],
    });
    expect(deps.circular().length, getMessage(deps.circular())).toBe(0);
  });

  it('javascript references should not be circular', async () => {
    const deps = await madge('packages', {
      fileExtensions: ['js'],
    });
    expect(deps.circular().length, getMessage(deps.circular())).toBe(0);
  });

  // Enable more strict circular checks if we refactor lang again.
  it.skip('malloy/src/lang typescript should not be circular', async () => {
    const deps = await madge('packages', {
      fileExtensions: ['ts'],
      excludeRegExp: [/malloy\/src\/lang\/lib/, /\.d\.ts/],
    });
    expect(deps.circular().length, getMessage(deps.circular())).toBe(0);
  });
});
