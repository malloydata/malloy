import malloyTestInput from '../../../grammars/malloy/malloyTestInput';
import {
  TextmateTestConfig,
  stubEmbeddedTextmateLanguage,
} from '../../testUtils';

const malloyDarkPlusConfig: TextmateTestConfig = {
  language: {
    id: 'malloy',
    scopeName: 'source.malloy',
    definition: 'grammars/malloy/malloy.tmGrammar.json',
    embeddedLanguages: [stubEmbeddedTextmateLanguage('sql', 'source.sql')],
  },
  theme: {
    id: 'vs-dark-plus',
    path: 'themes/textmate/dark_plus.json',
  },
  testInput: malloyTestInput,
};

export default malloyDarkPlusConfig;
