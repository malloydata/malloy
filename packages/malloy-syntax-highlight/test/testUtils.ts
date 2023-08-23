import {IRawGrammar} from 'vscode-textmate';

export interface TextmateTestConfig {
  language: {
    id: string;
    scopeName: string;
    definition: TextmateLanguageDefinition;
    embeddedLanguages?: EmbeddedTextmateLanguage[];
  };
  theme: {
    id: string;
    path: string;
  };
}

export type TextmateGrammarStub = Pick<IRawGrammar, "scopeName" | "patterns">;
export type TextmateLanguageDefinition = string | TextmateGrammarStub;

export interface EmbeddedTextmateLanguage {
  id: string;
  scopeName: string;
  definition: TextmateLanguageDefinition
}

export function stubEmbeddedTextmateLanguage(id: string, scopeName: string): EmbeddedTextmateLanguage  {
  return {
    id,
    scopeName,
    definition: {
      scopeName,
      patterns: [],
    }
  };
}

export interface RelaxedToken {
  startIndex: number;
  type: string | string[];
  color?: string;
}

export interface TestItem {
  line: string;
  tokens: RelaxedToken[];
}
