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

module.exports = {
  "env": {
    "browser": true,
    "jest": true,
    "node": true
  },
  "extends": [
    "prettier",
    "plugin:prettier/recommended",
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "ignorePatterns": [
    "*.d.ts",
    "node_modules/",
    "packages/malloy/src/lang/lib/Malloy"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "warnOnUnsupportedTypeScriptVersion": false,
    "project": ["./tsconfig.packages.json"]
  },
  "plugins": ["@typescript-eslint", "prettier"],
  "rules": {
    "no-console": "warn",
    "prettier/prettier": "error",
    "sort-keys": "off",
    "no-duplicate-imports": "error",
    "no-restricted-imports": [
      "error",
      {
        patterns: ["@malloydata/malloy/src/*"],
        paths: [
          {
            name: "lodash",
            message: "Import [module] from lodash/[module] instead"
          }
        ]
      }
    ],
    "no-use-before-define": "off",
    "no-throw-literal": "error",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
    ],
    "quote-props": ["error", "always"],
    "@typescript-eslint/restrict-plus-operands": "error",
    "@typescript-eslint/parameter-properties": [ "warn" , { "prefer": "parameter-property"}]
  }
};
