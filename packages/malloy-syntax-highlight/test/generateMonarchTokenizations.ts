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

import type {MonarchTestConfig, TestItem} from './testUtils';
import type {editor as Monaco, Token} from 'monaco-editor';

export async function loadMonacoAssets() {
  // Waiting resolves difficult to track down race condition
  await new Promise(resolve => setTimeout(resolve, 1000));
  // Uses the same setup as https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-amd.md
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.onload = resolve;
    script.onerror = reject;
    // Absolute paths can be seen in proxies of karma.conf.js
    script.src = '/base/monaco-editor/min/vs/loader.js';
    document.head.appendChild(script);
  });
  // Not requirejs, 'require' namespace and function are loaded with above script
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  require.config({
    baseUrl: '/base/monaco-editor/min',
  });
  await new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
