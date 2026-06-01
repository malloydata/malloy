/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {MalloyExplicitTheme} from '@/api/types';

// Convert a MalloyExplicitTheme prop name to the matching renderer CSS
// variable name, e.g. `tableRowHeight` -> `--malloy-render--table-row-height`.
export function themePropToCssVar(prop: keyof MalloyExplicitTheme): string {
  return `--malloy-render--${prop
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()}`;
}

// Set of `--malloy-render--*` CSS var names that the embedder has
// explicitly set via `props.theme`. Used to suppress same-named plugin
// style overrides so the explicit theme wins on the CSS cascade.
// `mapColor` is excluded because it is consumed by Vega scales, not
// rendered as a CSS var.
export function themeOverridesAsCssVarNames(
  theme: MalloyExplicitTheme | undefined
): Set<string> {
  const names = new Set<string>();
  if (!theme) return names;
  for (const [key, value] of Object.entries(theme)) {
    if (key === 'mapColor') continue;
    if (typeof value !== 'string' || value === '') continue;
    names.add(themePropToCssVar(key as keyof MalloyExplicitTheme));
  }
  return names;
}

// Resolve a single theme key. The first defined source wins:
//   1. explicitTheme[prop]: caller-supplied via MalloyRendererOptions.theme
//   2. localTheme tag: `# theme.<prop>` on the result
//   3. modelTheme tag: `## theme.<prop>` on the model
//   4. CSS fallback: `var(--malloy-theme--<kebab>)`
//
// An empty string from any source is treated as "unset" so a cleared
// form field falls through to the next source rather than emitting a
// malformed CSS declaration (`--malloy-render--*: ;`).
export function getThemeValue(
  prop: keyof MalloyExplicitTheme,
  explicitTheme: MalloyExplicitTheme | undefined,
  ...themes: Array<Tag | undefined>
): string {
  const explicit = explicitTheme?.[prop];
  if (typeof explicit === 'string' && explicit !== '') return explicit;
  for (const theme of themes) {
    const value = theme?.text(prop);
    if (typeof value === 'string' && value !== '') return value;
  }
  // If no theme overrides, convert prop name from camelCase to kebab and
  // pull from the --malloy-theme-- variable.
  return `var(--malloy-theme--${prop
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()})`;
}

export function generateThemeStyle(
  modelTheme?: Tag,
  localTheme?: Tag,
  explicitTheme?: MalloyExplicitTheme
): string {
  const tableRowHeight = getThemeValue(
    'tableRowHeight',
    explicitTheme,
    localTheme,
    modelTheme
  );
  const tableBodyColor = getThemeValue(
    'tableBodyColor',
    explicitTheme,
    localTheme,
    modelTheme
  );
  const tableFontSize = getThemeValue(
    'tableFontSize',
    explicitTheme,
    localTheme,
    modelTheme
  );
  const tableHeaderColor = getThemeValue(
    'tableHeaderColor',
    explicitTheme,
    localTheme,
    modelTheme
  );
  const tableHeaderWeight = getThemeValue(
    'tableHeaderWeight',
    explicitTheme,
    localTheme,
    modelTheme
  );
  const tableBodyWeight = getThemeValue(
    'tableBodyWeight',
    explicitTheme,
    localTheme,
    modelTheme
  );
  const tableBorder = getThemeValue(
    'tableBorder',
    explicitTheme,
    localTheme,
    modelTheme
  );
  const tableBackground = getThemeValue(
    'tableBackground',
    explicitTheme,
    localTheme,
    modelTheme
  );
  const tableGutterSize = getThemeValue(
    'tableGutterSize',
    explicitTheme,
    localTheme,
    modelTheme
  );
  const tablePinnedBackground = getThemeValue(
    'tablePinnedBackground',
    explicitTheme,
    localTheme,
    modelTheme
  );
  const tablePinnedBorder = getThemeValue(
    'tablePinnedBorder',
    explicitTheme,
    localTheme,
    modelTheme
  );
  const fontFamily = getThemeValue(
    'fontFamily',
    explicitTheme,
    localTheme,
    modelTheme
  );
  const background = getThemeValue(
    'background',
    explicitTheme,
    localTheme,
    modelTheme
  );

  const css = `
    --malloy-render--table-row-height: ${tableRowHeight};
    --malloy-render--table-body-color: ${tableBodyColor};
    --malloy-render--table-font-size: ${tableFontSize};
    --malloy-render--font-family: ${fontFamily};
    --malloy-render--table-header-color: ${tableHeaderColor};
    --malloy-render--table-header-weight: ${tableHeaderWeight};
    --malloy-render--table-body-weight: ${tableBodyWeight};
    --malloy-render--table-border: ${tableBorder};
    --malloy-render--table-background: ${tableBackground};
    --malloy-render--table-gutter-size: ${tableGutterSize};
    --malloy-render--table-pinned-background: ${tablePinnedBackground};
    --malloy-render--table-pinned-border: ${tablePinnedBorder};
    --malloy-render--background: ${background};

`;
  return css;
}

// Merge the `theme` option for MalloyViz.updateOptions. A partial theme
// update merges into the previously-set keys instead of replacing the
// whole object; passing `theme: undefined` (hasThemeKey true, next
// undefined) clears it; omitting `theme` (hasThemeKey false) leaves the
// previous theme untouched.
export function mergeThemeOption(
  prev: MalloyExplicitTheme | undefined,
  hasThemeKey: boolean,
  next: MalloyExplicitTheme | undefined
): MalloyExplicitTheme | undefined {
  if (!hasThemeKey) return prev;
  if (next === undefined) return undefined;
  return {...prev, ...next};
}
