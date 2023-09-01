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
  const outputTemplate = `import {editor as Monaco} from 'monaco-editor';

export const theme: Monaco.IStandaloneThemeData = ${inspect(theme, {
    depth: null,
    maxArrayLength: null,
  })};
`;
  writeFileSync(outPath, outputTemplate, 'utf-8');
}

generateMonarchTheme(process.argv[2], process.argv[3]);
