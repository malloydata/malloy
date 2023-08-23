const json5 = require('json5');
const fs = require('fs');
const path = require('path');
const util = require('util');

import {
  Registry,
  parseRawGrammar,
  INITIAL,
  IRawTheme,
  IGrammar,
  IToken,
} from 'vscode-textmate';
import {loadWASM, OnigScanner, OnigString} from 'vscode-oniguruma';

import {GoldenTestConfig, RelaxedToken, TestItem} from './testUtils';

import malloyTestDefinitions from '../grammars/malloy/malloyTestDefinitions';

const FOREGROUND_MASK = 0b00000000011111111100000000000000;
const FOREGROUND_OFFSET = 15;

// TODO: Add type definitions to readFile
function readFile(path: string) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (error, data) => (error ? reject(error) : resolve(data)));
  });
}

function retrieveHighlightTestConfig(path: string): GoldenTestConfig {
  const configSrc = fs.readFileSync(path, 'utf-8');
  const rawConfig: GoldenTestConfig = JSON.parse(configSrc);
  return rawConfig;
}

function initializeLanguageMap(
  config: GoldenTestConfig
): Record<string, string> {
  const languageMap: Record<string, string> = {};
  if (config.language.embeddedLanguages) {
    for (const lang of config.language.embeddedLanguages) {
      languageMap[lang.scopeName] = lang.path;
    }
  }
  languageMap[config.language.scopeName] = config.language.path;
  return languageMap;
}

function initializeRegistry(
  languageMap: Record<string, string>,
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
    loadGrammar: scopeName =>
      readFile(languageMap[scopeName]).then((data: any) =>
        parseRawGrammar(data.toString(), languageMap[scopeName])
      ),
  });
  return registry;
}

function retrieveEditorTheme(config: GoldenTestConfig): IRawTheme {
  const themeSrc = fs.readFileSync(config.theme.path, 'utf-8');
  const rawTheme = json5.parse(themeSrc);
  return {settings: rawTheme.tokenColors};
}

// async function loadLanguages(registry: Registry, languageMap: Record<string, string>): Promise<unknown> {
//     const promises: Promise<unknown>[] = []
//     Object.keys(languageMap).forEach((languageId: string) => {
//         promises.push(registry.loadGrammar(languageId));
//     });
//     return Promise.all(promises);
// }

function constructLineGolden(
  line: string,
  full: IToken[],
  binary: Uint32Array,
  colorMap: string[]
): TestItem {
  const lineGolden: TestItem = {
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
    lineGolden.tokens.push({
      startIndex: tokenInfo.startIndex,
      type: tokenInfo.scopes,
      color: indexToColorMap[prevIndex],
    });
  }
  return lineGolden;
}

function getForegroundColor(metadata: number): number {
  return (metadata & FOREGROUND_MASK) >>> FOREGROUND_OFFSET;
}

function tokenizeMultilineDefinitions(
  grammar: IGrammar,
  registry: Registry,
  definitions: string[][]
): TestItem[][] {
  const goldens: TestItem[][] = [];
  for (let i = 0; i < definitions.length; i++) {
    const blockGolden: TestItem[] = [];
    let ruleStack = INITIAL;
    for (let j = 0; j < definitions[i].length; j++) {
      const line = definitions[i][j];
      const full = grammar.tokenizeLine(line, ruleStack);
      const binary = grammar.tokenizeLine2(line, ruleStack);
      blockGolden.push(
        constructLineGolden(
          line,
          full.tokens,
          binary.tokens,
          registry.getColorMap()
        )
      );
      ruleStack = full.ruleStack;
    }
    goldens.push(blockGolden);
  }
  return goldens;
}

function writeGoldens(goldens: TestItem[][], outputPath: string) {
  const outputTemplate = `export default ${util.inspect(goldens, {
    depth: null,
  })};`;
  fs.writeFileSync(outputPath, outputTemplate, 'utf-8');
}

export async function generateLanguageGolden(
  configPath: string,
  outputPath: string,
  testDefinitions: string[][]
) {
  const config = retrieveHighlightTestConfig(configPath);
  const languageMap = initializeLanguageMap(config);
  const registry = initializeRegistry(languageMap, retrieveEditorTheme(config));
  registry
    .loadGrammar(config.language.scopeName)
    .then(grammar => {
      if (grammar) {
        const goldens = tokenizeMultilineDefinitions(
          grammar,
          registry,
          testDefinitions
        );
        writeGoldens(goldens, outputPath);
      }
    })
    .catch(error => {
      console.log(error);
    });
}

// TODO: Validate command line args
generateLanguageGolden(process.argv[2], process.argv[3], malloyTestDefinitions);
