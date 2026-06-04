/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Note the use of the .js extensions for imports (not necessary for type imports)
// to run with Karma
import type {MonarchTestConfig} from '../../testUtils.js';
import {stubEmbeddedMonarchGrammar} from '../../testUtils.js';
import {monarch as malloy} from '../../../grammars/malloy/malloy.monarch.js';
import {theme as darkPlus} from '../../../themes/monaco/darkPlus.js';
import {commonTestInput} from '../../../grammars/malloy/malloyTestInput.js';
import malloyDarkPlus from '../../../grammars/malloy/tokenizations/darkPlus.js';

export const malloyDarkPlusConfig: MonarchTestConfig = {
  language: {
    id: 'malloy',
    definition: malloy,
  },
  embeddedLanguages: [
    {
      id: 'sql',
      definition: stubEmbeddedMonarchGrammar('sql'),
    },
  ],
  theme: darkPlus,
  // Monarch (Karma) only checks the parity-clean blocks. The default test input is
  // [...commonTestInput, ...monarchDivergentTestInput], so the leading slice of the
  // TextMate ground truth lines up exactly with commonTestInput. See malloyTestInput.ts.
  testInput: commonTestInput,
  expectations: malloyDarkPlus.slice(0, commonTestInput.length),
};
