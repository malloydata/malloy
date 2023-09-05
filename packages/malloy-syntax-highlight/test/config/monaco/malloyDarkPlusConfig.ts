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

// Note the use of the .js extensions for imports (not necessary for type imports)
// to run with Karma
import {
  MonarchTestConfig,
  stubEmbeddedMonarchGrammar,
} from '../../testUtils.js';
import {monarch as malloy} from '../../../grammars/malloy/malloy.monarch.js';
import {theme as darkPlus} from '../../../themes/monaco/darkPlus.js';
import malloyTestInput from '../../../grammars/malloy/malloyTestInput.js';
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
  testInput: malloyTestInput,
  expectations: malloyDarkPlus,
};
