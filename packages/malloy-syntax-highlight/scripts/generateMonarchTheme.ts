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

import {editor as Monaco} from 'monaco-editor';
import {retrieveEditorTheme} from '../test/generateTextmateTokenizations';
import {inspect} from 'util';
import {writeFileSync} from 'fs';
import {IRawTheme} from 'vscode-textmate';

function generateMonarchTheme(inPath: string, outPath: string) {
  const rawTextmateTheme = retrieveEditorTheme(inPath);
  const initialMonacoTheme: Monaco.IStandaloneThemeData = {
    base: 'vs',
    inherit: false,
    rules: [],
    colors: {},
  };
  convertThemeToMonaco(rawTextmateTheme, initialMonacoTheme);
  writeTheme(initialMonacoTheme, outPath);
}

export function convertThemeToMonaco(
  rawTextmateTheme: IRawTheme,
  monacoTheme: Monaco.IStandaloneThemeData
) {
  for (const setting of rawTextmateTheme.settings) {
    if (setting.settings.foreground && setting.scope) {
      if (typeof setting.scope === 'string') {
        monacoTheme.rules.push({
          token: setting.scope,
          foreground: setting.settings.foreground,
        });
      } else {
        for (const scope of setting.scope) {
          monacoTheme.rules.push({
            token: scope,
            foreground: setting.settings.foreground.toUpperCase(),
          });
        }
      }
    }
  }
}

export function writeTheme(
  theme: Monaco.IStandaloneThemeData,
  outPath: string
) {
  const outputTemplate = `
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

import {editor as Monaco} from 'monaco-editor';

export const theme: Monaco.IStandaloneThemeData = ${inspect(theme, {
    depth: null,
    maxArrayLength: null,
  })};
`;
  writeFileSync(outPath, outputTemplate, 'utf-8');
}

generateMonarchTheme(process.argv[2], process.argv[3]);
