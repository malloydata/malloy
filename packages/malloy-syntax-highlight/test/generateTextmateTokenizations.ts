const json5 = require('json5');
const fs = require('fs');
const path = require('path');
const util = require('util');

import {
  Registry,
  parseRawGrammar,
  INITIAL,
  IRawTheme,
  IRawGrammar,
  IGrammar,
  IToken,
} from 'vscode-textmate';
import {loadWASM, OnigScanner, OnigString} from 'vscode-oniguruma';

import {TextmateTestConfig, TestItem, TextmateLanguageDefinition} from './testUtils';

import malloyTestDefinitions from '../grammars/malloy/malloyTestInput';

import malloyDarkPlusConfig from './config/malloyDarkPlusConfig';

const FOREGROUND_MASK = 0b00000000011111111100000000000000;
const FOREGROUND_OFFSET = 15;

// TODO: Add type definitions to readFile
function readFile(path: string) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (error, data) => (error ? reject(error) : resolve(data)));
  });
}

function retrieveHighlightTestConfig(path: string): TextmateTestConfig {
  const configSrc = fs.readFileSync(path, 'utf-8');
  const rawConfig: TextmateTestConfig = JSON.parse(configSrc);
  return rawConfig;
}

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

function initializeRegistry(
  languageMap: Record<string, TextmateLanguageDefinition>,
  theme: IRawTheme
) {
  const wasmBin = fs.readFileSync(
    path.join(__dirname, '../node_modules/vscode-oniguruma/release/onig.wasm')
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
    // TODO: Remove usage of any here
    loadGrammar: scopeName => {
      const languageDefinition: TextmateLanguageDefinition = languageMap[scopeName];
      if (typeof languageDefinition === 'string') {
        return readFile(languageDefinition).then((rawGrammarSrc: any) => parseRawGrammar(rawGrammarSrc.toString(), languageDefinition))
      } else {
        return Promise.resolve(languageDefinition as unknown as IRawGrammar);
      }
    },
  });
  return registry;
}

function retrieveEditorTheme(config: TextmateTestConfig): IRawTheme {
  const themeSrc = fs.readFileSync(config.theme.path, 'utf-8');
  const rawTheme = json5.parse(themeSrc);
  return {settings: rawTheme.tokenColors};
}

function constructLineTokenization(
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
        constructLineTokenization(
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

function writeTokenizations(tokenizations: TestItem[][], outputPath: string) {
  const outputTemplate = `export default ${util.inspect(tokenizations, {
    depth: null,
  })};`;
  fs.writeFileSync(outputPath, outputTemplate, 'utf-8');
}

export async function generateTextmateTokenizations(
  config: TextmateTestConfig,
  testDefinitions: string[][]
): Promise<TestItem[][]> {
  const languageMap = initializeLanguageMap(config);
  const registry = initializeRegistry(languageMap, retrieveEditorTheme(config));
  const grammar = await registry.loadGrammar(config.language.scopeName)
  return tokenizeMultilineDefinitions(grammar, registry, testDefinitions);
}

// TODO: Validate command line args
async function main(config: TextmateTestConfig, testDefinitions: string[][], outputPath: string) {
  const tokenizations = await generateTextmateTokenizations(malloyDarkPlusConfig, testDefinitions);
  writeTokenizations(tokenizations, outputPath);
}

main(malloyDarkPlusConfig, malloyTestDefinitions, process.argv[2]);
