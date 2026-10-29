/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {MalloyExplicitTheme} from '@/api/types';

// Convert a camelCase theme prop name to its kebab-case CSS suffix,
// e.g. `tableRowHeight` -> `table-row-height`.
function propToKebab(prop: keyof MalloyExplicitTheme): string {
  return prop.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// Convert a MalloyExplicitTheme prop name to the matching renderer CSS
// variable name, e.g. `tableRowHeight` -> `--malloy-render--table-row-height`.
function themePropToCssVar(prop: keyof MalloyExplicitTheme): string {
  return `--malloy-render--${propToKebab(prop)}`;
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
  return `var(--malloy-theme--${propToKebab(prop)})`;
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

  // The dashboard's styling renders from the internal --malloy-theme--dashboard-*
  // CSS defaults below; it is intentionally NOT exposed as public # theme tag
  // keys (no getThemeValue reads). Per-dashboard theming is deferred to the
  // themes design rather than invented as per-component tag keys in a layout
  // change.
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
    --malloy-render--dashboard-bg: var(--malloy-theme--dashboard-bg);
    --malloy-render--dashboard-card-bg: var(--malloy-theme--dashboard-card-bg);
    --malloy-render--dashboard-card-radius: var(--malloy-theme--dashboard-card-radius);
    --malloy-render--dashboard-card-padding: var(--malloy-theme--dashboard-card-padding);
    --malloy-render--dashboard-title-size: var(--malloy-theme--dashboard-title-size);
    --malloy-render--dashboard-title-weight: var(--malloy-theme--dashboard-title-weight);
    --malloy-render--dashboard-title-color: var(--malloy-theme--dashboard-title-color);
    --malloy-render--dashboard-value-size: var(--malloy-theme--dashboard-value-size);
    --malloy-render--dashboard-gap: var(--malloy-theme--dashboard-gap);
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
