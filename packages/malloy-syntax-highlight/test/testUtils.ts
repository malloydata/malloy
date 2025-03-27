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

import type {IRawGrammar} from 'vscode-textmate';
import type {languages as Monarch, editor as Monaco} from 'monaco-editor';

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
  testInput: string[][];
}

export type TextmateGrammarStub = Pick<IRawGrammar, 'scopeName' | 'patterns'>;
export type TextmateLanguageDefinition = string | TextmateGrammarStub;

export interface EmbeddedTextmateLanguage {
  id: string;
  scopeName: string;
  definition: TextmateLanguageDefinition;
}

export function stubEmbeddedTextmateLanguage(
  id: string,
  scopeName: string
): EmbeddedTextmateLanguage {
  return {
    id,
    scopeName,
    definition: {
      scopeName,
      patterns: [],
    },
  };
}

export interface MonarchTestConfig {
  language: MonarchLanguage;
  embeddedLanguages: MonarchLanguage[];
  theme: Monaco.IStandaloneThemeData;
  testInput: string[][];
  expectations: TestItem[][];
}

export interface MonarchLanguage {
  id: string;
  definition: Monarch.IMonarchLanguage;
}

export function stubEmbeddedMonarchGrammar(
  id: string
): Monarch.IMonarchLanguage {
  return {
    tokenizer: {
      root: [],
    },
    defaultToken: `source.${id}`,
  };
}

export interface RelaxedToken {
  startIndex: number;
  type: string | string[];
  color: string;
}

export interface TestItem {
  line: string;
  tokens: RelaxedToken[];
}

/*
 *  Make Jasmine aware of custom matchers to prevent warnings
 *  in spec.ts and test.ts files that use theme
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jasmine {
    interface Matchers<T = TestItem> {
      toMatchColorData(expected: T): boolean;
    }
  }
}

export const monarchTestMatchers: jasmine.CustomMatcherFactories = {
  'toMatchColorData': function (
    matchersUtil: jasmine.MatchersUtil
  ): jasmine.CustomMatcher {
    return {
      compare: function (
        actual: TestItem,
        expected: TestItem
      ): jasmine.CustomMatcherResult {
        const result: jasmine.CustomMatcherResult = {pass: false, message: ''};
        const actualIndexToColorMap = generateIndexToColorMap(actual.tokens);
        const expectedIndexToColorMap = generateIndexToColorMap(
          expected.tokens
        );
        result.pass = matchersUtil.equals(
          actualIndexToColorMap,
          expectedIndexToColorMap
        );
        if (!result.pass) {
          let message = `\nWhile tokenizing line "${expected.line}"\nExpected:\n`;
          for (const [index, color] of Object.entries(
            expectedIndexToColorMap
          )) {
            message += `  color ${color} to begin at index ${index}\n`;
          }
          message += 'Received:\n';
          for (const [index, color] of Object.entries(actualIndexToColorMap)) {
            message += `  color ${color} beginning at index ${index}\n`;
          }
          message += '\n';
          message += `Expected tokenization:\n${JSON.stringify(
            expected.tokens,
            null,
            2
          )}\ndoes not yield the same colors as actual tokenization:\n${JSON.stringify(
            actual.tokens,
            null,
            2
          )}`;
          result.message = message;
        }
        return result;
      },
    };
  },
};

function generateIndexToColorMap(tokens: RelaxedToken[]) {
  const indexToColorMap: Record<number, string> = {};
  let prevColor = '';
  for (const token of tokens) {
    if (!prevColor || prevColor !== token.color) {
      indexToColorMap[token.startIndex] = token.color;
      prevColor = token.color;
    }
  }
  return indexToColorMap;
}
