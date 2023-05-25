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

import {ESLintUtils} from '@typescript-eslint/utils';
import rule from './quote_string_properties';
import {join} from 'path';
import fs from 'fs';

beforeAll(() => {
  // Somewhat oddly, RuleTester needs a file named 'file.ts' to exist
  fs.closeSync(fs.openSync('file.ts', 'w'));
});

afterAll(() => {
  fs.unlinkSync('file.ts');
});

// create a new tester with a typescript parser
const ruleTester = new ESLintUtils.RuleTester({
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: join(__dirname, '..', '..', '..'),
    project: './tsconfig.packages.json',
  },
});

// pass in test cases
ruleTester.run('quote-string-properties', rule, {
  // valid case has no errors
  valid: [
    {
      code: `
        const A: Record<string, number> = {
          "a": 1,
          "b": 2,
        }`,
    },
    {
      code: `
        const A: Record<"a"|"b", number> = {
          a: 1,
          b: 2,
        }`,
    },
    {
      code: `
        const A = {
          a: 1,
          b: 2,
        }`,
    },
    {
      code: `
        class C {
          A: Record<string, number> = {
            "a": 1,
            "b": 2,
          }
        }`,
    },
  ],
  invalid: [
    {
      code: `
        const A: Record<string, number> = {
          a: 1,
          b: 2,
        }`,
      errors: [
        {
          messageId: 'quoteKey',
        },
        {
          messageId: 'quoteKey',
        },
      ],
      output: `
        const A: Record<string, number> = {
          "a": 1,
          "b": 2,
        }`,
    },
    {
      code: `
        class C {
          A: Record<string, number> = {
            a: 1,
            b: 2,
          }
        }`,
      errors: [
        {
          messageId: 'quoteKey',
        },
        {
          messageId: 'quoteKey',
        },
      ],
      output: `
        class C {
          A: Record<string, number> = {
            "a": 1,
            "b": 2,
          }
        }`,
    },
  ],
});
