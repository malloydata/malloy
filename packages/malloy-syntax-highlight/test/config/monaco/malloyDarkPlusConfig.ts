// Note the use of the .js extensions for imports (not necessary for type imports)
// to run with Karma
import {
  MonarchTestConfig,
  stubEmbeddedMonarchGrammar,
} from '../../testUtils.js';
import {monarch as malloy} from '../../../grammars/malloy/malloy.js';
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
