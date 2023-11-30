import {Tag} from '@malloydata/malloy';

export const defaultTheme = {
  'tableRowHeight': '28px',
  'tableBodyColor': '#727883',
  'tableFontSize': '12px',
  'tableHeaderColor': '#5d626b',
  'tableHeaderWeight': 'bold',
  'tableBodyWeight': '400',
  'tableBorder': '1px solid #e5e7eb',
  'tableBackground': 'white',
  'tableGutterSize': '15px',
  'tablePinnedBackground': '#f5fafc',
  'tablePinnedBorder': '1px solid #daedf3',
};

export function getThemeValue(prop: string, ...themes: Array<Tag | undefined>) {
  let value: string | undefined;
  for (const theme of themes) {
    value = theme?.text(prop);
    if (typeof value !== 'undefined') break;
  }
  return value ?? defaultTheme[prop];
}
