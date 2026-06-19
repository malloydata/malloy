/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import malloyTestInput from '../../../grammars/malloy/malloyTestInput';
import type {TextmateTestConfig} from '../../testUtils';
import {stubEmbeddedTextmateLanguage} from '../../testUtils';

const malloyDarkPlusConfig: TextmateTestConfig = {
  language: {
    id: 'malloy',
    scopeName: 'source.malloy',
    definition: '../grammars/malloy/malloy.tmGrammar.json',
    embeddedLanguages: [
      stubEmbeddedTextmateLanguage('sql', 'source.sql'),
      // MOTLY is the tag-property language embedded in annotation bodies. Unlike
      // the SQL stub, we register the real grammar so the snapshot reflects its
      // actual scopes. Path is relative to test/ (where the loader resolves it).
      {
        id: 'motly',
        scopeName: 'source.motly',
        definition:
          '../../../node_modules/@malloydata/motly-ts-parser/grammar/source.motly.tmGrammar.json',
      },
    ],
  },
  theme: {
    id: 'vs-dark-plus',
    path: '../themes/textmate/dark_plus.json',
  },
  testInput: malloyTestInput,
};

export default malloyDarkPlusConfig;
