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

import {join as pathJoin} from 'path';
import {readFileSync} from 'fs';
import {readFile as promiseReadFile} from 'fs/promises';
import {parse as json5Parse} from 'json5';
import type {IRawTheme, IRawGrammar, IGrammar, IToken} from 'vscode-textmate';
import {Registry, parseRawGrammar, INITIAL} from 'vscode-textmate';
import {loadWASM, OnigScanner, OnigString} from 'vscode-oniguruma';
import type {
  TextmateTestConfig,
  TestItem,
  TextmateLanguageDefinition,
} from './testUtils';

const FOREGROUND_MASK = 0b00000000011111111100000000000000;
const FOREGROUND_OFFSET = 15;

function initializeLanguageMap(
  config: TextmateTestConfig
): Record<string, TextmateLanguageDefinition> {
  const languageMap: Record<string, TextmateLanguageDefinition> = {};
  if (config.language.embeddedLanguages) {
    for (const lang of config.language.embeddedLanguages) {
      languageMap[lang.scopeName] = lang.definition;
    }
  }
  languageMap[config.language.scopeName] = config.language.definition;
  return languageMap;
}

export function retrieveEditorTheme(path: string): IRawTheme {
  const themeSrc = readFileSync(pathJoin(__dirname, path), 'utf-8');
  const rawTheme = json5Parse(themeSrc);
  return {settings: rawTheme.tokenColors};
}

function initializeRegistry(
  languageMap: Record<string, TextmateLanguageDefinition>,
  theme: IRawTheme
) {
  const wasmBin = readFileSync(
    pathJoin(
      __dirname,
      '../../../node_modules/vscode-oniguruma/release/onig.wasm'
    )
  ).buffer;
  const vscodeOnigurumaLib = loadWASM(wasmBin).then(() => {
    return {
      createOnigScanner(patterns: string[]) {
        return new OnigScanner(patterns);
      },
      createOnigString(s: string) {
        return new OnigString(s);
      },
    };
  });
  const registry = new Registry({
    onigLib: vscodeOnigurumaLib,
    theme: theme,
    loadGrammar: async scopeName => {
      const languageDefinition: TextmateLanguageDefinition =
        languageMap[scopeName];
      if (typeof languageDefinition === 'string') {
        return promiseReadFile(pathJoin(__dirname, languageDefinition)).then(
          rawGrammarSrc =>
            parseRawGrammar(rawGrammarSrc.toString(), languageDefinition)
        );
      } else {
        return Promise.resolve(languageDefinition as unknown as IRawGrammar);
      }
    },
  });
  return registry;
}

function joinTokensWithColorInfo(
  line: string,
  full: IToken[],
  binary: Uint32Array,
  colorMap: string[]
): TestItem {
  const lineTokenization: TestItem = {
    line: line,
    tokens: [],
  };
  const indexToColorMap: Record<number, string> = {};
  for (let j = 0; j < binary.length; j += 2) {
    const startIndex = binary[j];
    const metadata = binary[j + 1];
    const colorId = getForegroundColor(metadata);
    indexToColorMap[startIndex] = colorMap[colorId];
  }
  let prevIndex = 0;
  for (const tokenInfo of full) {
    if (indexToColorMap[tokenInfo.startIndex]) {
      prevIndex = tokenInfo.startIndex;
    }
    lineTokenization.tokens.push({
      startIndex: tokenInfo.startIndex,
      type: tokenInfo.scopes,
      color: indexToColorMap[prevIndex],
    });
  }
  return lineTokenization;
}

function getForegroundColor(metadata: number): number {
  return (metadata & FOREGROUND_MASK) >>> FOREGROUND_OFFSET;
}

function tokenizeMultilineDefinitions(
  grammar: IGrammar,
  registry: Registry,
  definitions: string[][]
): TestItem[][] {
  const tokenizations: TestItem[][] = [];
  for (let i = 0; i < definitions.length; i++) {
    const blockTokenization: TestItem[] = [];
    let ruleStack = INITIAL;
    for (let j = 0; j < definitions[i].length; j++) {
      const line = definitions[i][j];
      const full = grammar.tokenizeLine(line, ruleStack);
      const binary = grammar.tokenizeLine2(line, ruleStack);
      blockTokenization.push(
        joinTokensWithColorInfo(
          line,
          full.tokens,
          binary.tokens,
          registry.getColorMap()
        )
      );
      ruleStack = full.ruleStack;
    }
    tokenizations.push(blockTokenization);
  }
  return tokenizations;
}

export async function generateTextmateTokenizations(
  config: TextmateTestConfig
): Promise<TestItem[][]> {
  const languageMap = initializeLanguageMap(config);
  const registry = initializeRegistry(
    languageMap,
    retrieveEditorTheme(config.theme.path)
  );
  const grammar = await registry.loadGrammar(config.language.scopeName);
  if (!grammar) {
    throw new Error(
      `Cannot load the TextMate grammar for scope name ${config.language.scopeName}`
    );
  }
  return tokenizeMultilineDefinitions(grammar, registry, config.testInput);
}
