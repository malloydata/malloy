import {ESLintUtils} from '@typescript-eslint/utils';
import rule from './quote_string_properties';
import {join} from 'path';

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
