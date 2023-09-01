import {MonarchTestConfig, TestItem} from './testUtils';
import {editor as Monaco, Token} from 'monaco-editor';

export async function loadMonacoAssets() {
  // Waiting resolves difficult to track down race condition
  await new Promise(resolve => setTimeout(resolve, 1000));
  // Uses the same setup as https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-amd.md
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.onload = resolve;
    script.onerror = reject;
    script.src = '/base/node_modules/monaco-editor/min/vs/loader.js';
    document.head.appendChild(script);
  });
  // Not requirejs, 'require' namespace and function are loaded with above script
  // @ts-ignore
  require.config({
    baseUrl: '/base/node_modules/monaco-editor/min',
  });
  await new Promise((resolve, reject) => {
    // @ts-ignore
    require(['vs/editor/editor.main'], resolve, reject);
  });
}

function registerLanguages(monacoGlobal, testConfig: MonarchTestConfig) {
  for (const language of testConfig.embeddedLanguages) {
    monacoGlobal.languages.register({id: language.id});
    monacoGlobal.languages.setMonarchTokensProvider(
      language.id,
      language.definition
    );
    // monacoGlobal.languages.setLanguageConfiguration(language.id, language.configuration);
  }
  monacoGlobal.languages.register({id: testConfig.language.id});
  monacoGlobal.languages.setMonarchTokensProvider(
    testConfig.language.id,
    testConfig.language.definition
  );
  // monacoGlobal.languages.setLanguageConfiguration(testConfig.language.id, testConfig.language.configuration);
}

function setupEditor(monacoGlobal, theme: Monaco.IStandaloneThemeData) {
  monacoGlobal.editor.defineTheme('test-theme', theme);
  const element = document.createElement('div');
  element.id = 'editor';
  document.body.appendChild(element);
  const editor = monacoGlobal.editor.create(document.getElementById('editor'), {
    theme: 'test-theme',
  });
  return editor;
}

export function generateMonarchTokenizations(
  monacoGlobal,
  testConfig: MonarchTestConfig
): TestItem[][] {
  const tokenizations: TestItem[][] = [];
  registerLanguages(monacoGlobal, testConfig);
  const editor = setupEditor(monacoGlobal, testConfig.theme);
  const colorMap = editor._themeService
    .getColorTheme()
    .tokenTheme.getColorMap();
  for (const lines of testConfig.testInput) {
    const block = lines.join('\n');
    const actualTokens: Token[][] = monacoGlobal.editor.tokenize(
      block,
      testConfig.language.id
    );
    const cleanedTokens: TestItem[] = actualTokens.map((lineTokens, index) => {
      return {
        line: lines[index],
        tokens: lineTokens.map(lineToken => {
          const tokenColorId = editor._themeService
            .getColorTheme()
            .getTokenStyleMetadata(lineToken.type).foreground;
          return {
            startIndex: lineToken.offset,
            type: lineToken.type,
            color: colorMap[tokenColorId].toString().toUpperCase(),
          };
        }),
      };
    });
    tokenizations.push(cleanedTokens);
  }
  return tokenizations;
}
