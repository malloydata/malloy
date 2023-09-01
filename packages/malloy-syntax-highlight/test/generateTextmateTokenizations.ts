import { join as pathJoin } from 'path';
import { readFileSync } from 'fs';
import { readFile as promiseReadFile } from 'fs/promises';
import { parse as json5Parse } from 'json5';
import {
  Registry,
  parseRawGrammar,
  INITIAL,
  IRawTheme,
  IRawGrammar,
  IGrammar,
  IToken,
} from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import {
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
  const themeSrc = readFileSync(path, 'utf-8');
  const rawTheme = json5Parse(themeSrc);
  return { settings: rawTheme.tokenColors };
}

function initializeRegistry(
  languageMap: Record<string, TextmateLanguageDefinition>,
  theme: IRawTheme
) {
  const wasmBin = readFileSync(
    pathJoin(__dirname, '../node_modules/vscode-oniguruma/release/onig.wasm')
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
    loadGrammar: async (scopeName) => {
      const languageDefinition: TextmateLanguageDefinition =
        languageMap[scopeName];
      if (typeof languageDefinition === 'string') {
        return promiseReadFile(languageDefinition).then((rawGrammarSrc) =>
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
  return tokenizeMultilineDefinitions(grammar, registry, config.testInput);
}
