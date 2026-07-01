/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Tag} from '@malloydata/malloy-tag';
import {
  getThemeValue,
  themeOverridesAsCssVarNames,
  generateThemeStyle,
  mergeThemeOption,
} from './theme';

// Build a theme sub-tag with the shape `tag.tag('theme')` returns: a tag
// whose top-level properties are the theme keys (e.g. `# theme.tableBodyColor=red`).
function themeTag(values: Record<string, string>): Tag {
  let tag = Tag.withPrefix('# ');
  for (const [key, value] of Object.entries(values)) {
    tag = tag.set([key], value);
  }
  return tag;
}

describe('getThemeValue precedence', () => {
  test('explicitTheme wins over both the local and model tags', () => {
    const local = themeTag({tableBodyColor: 'localBlue'});
    const model = themeTag({tableBodyColor: 'modelGreen'});
    expect(
      getThemeValue(
        'tableBodyColor',
        {tableBodyColor: 'explicitRed'},
        local,
        model
      )
    ).toBe('explicitRed');
  });

  test('the local tag wins over the model tag when explicit is unset', () => {
    const local = themeTag({tableBodyColor: 'localBlue'});
    const model = themeTag({tableBodyColor: 'modelGreen'});
    expect(getThemeValue('tableBodyColor', undefined, local, model)).toBe(
      'localBlue'
    );
  });

  test('the model tag is used when explicit and local are unset', () => {
    const model = themeTag({tableBodyColor: 'modelGreen'});
    expect(getThemeValue('tableBodyColor', undefined, undefined, model)).toBe(
      'modelGreen'
    );
  });

  test('falls back to the --malloy-theme-- var, kebab-casing a multi-word key', () => {
    expect(getThemeValue('tablePinnedBackground', undefined)).toBe(
      'var(--malloy-theme--table-pinned-background)'
    );
  });

  test('an empty-string explicit value is treated as unset and falls through', () => {
    const local = themeTag({tableBodyColor: 'localBlue'});
    expect(getThemeValue('tableBodyColor', {tableBodyColor: ''}, local)).toBe(
      'localBlue'
    );
  });

  test('an empty-string tag value falls through to the next source', () => {
    const local = themeTag({tableBodyColor: ''});
    const model = themeTag({tableBodyColor: 'modelGreen'});
    expect(getThemeValue('tableBodyColor', undefined, local, model)).toBe(
      'modelGreen'
    );
  });

  test('all sources empty returns the var() fallback, never an empty value', () => {
    const local = themeTag({tableBodyColor: ''});
    expect(getThemeValue('tableBodyColor', {tableBodyColor: ''}, local)).toBe(
      'var(--malloy-theme--table-body-color)'
    );
  });
});

describe('themeOverridesAsCssVarNames', () => {
  test('returns an empty set for an undefined theme', () => {
    expect(themeOverridesAsCssVarNames(undefined).size).toBe(0);
  });

  test('maps set keys to --malloy-render-- names, kebab-casing multi-word keys', () => {
    const names = themeOverridesAsCssVarNames({
      background: '#fff',
      tablePinnedBorder: '1px solid #ccc',
    });
    expect(names.has('--malloy-render--background')).toBe(true);
    expect(names.has('--malloy-render--table-pinned-border')).toBe(true);
  });

  test('excludes mapColor, which is consumed by Vega rather than a CSS var', () => {
    const names = themeOverridesAsCssVarNames({
      mapColor: '#f00',
      background: '#fff',
    });
    expect(names.has('--malloy-render--map-color')).toBe(false);
    expect(names.has('--malloy-render--background')).toBe(true);
  });

  test('skips empty-string values so a cleared key suppresses nothing', () => {
    expect(themeOverridesAsCssVarNames({background: ''}).size).toBe(0);
  });
});

describe('generateThemeStyle', () => {
  test('emits explicit values into the --malloy-render-- variables', () => {
    const css = generateThemeStyle(undefined, undefined, {
      background: '#abc',
      tableRowHeight: '40px',
    });
    expect(css).toContain('--malloy-render--background: #abc;');
    expect(css).toContain('--malloy-render--table-row-height: 40px;');
  });

  test('omitted keys emit the var() fallback, not an empty declaration', () => {
    const css = generateThemeStyle(undefined, undefined, {background: '#abc'});
    expect(css).toContain(
      '--malloy-render--table-body-color: var(--malloy-theme--table-body-color);'
    );
    expect(css).not.toContain('--malloy-render--table-body-color: ;');
  });
});

describe('mergeThemeOption', () => {
  const prev = {background: '#fff', mapColor: '#00f'};

  test('a partial update merges into the previous theme, preserving siblings', () => {
    expect(mergeThemeOption(prev, true, {mapColor: '#f00'})).toEqual({
      background: '#fff',
      mapColor: '#f00',
    });
  });

  test('an explicit undefined theme clears it', () => {
    expect(mergeThemeOption(prev, true, undefined)).toBeUndefined();
  });

  test('omitting the theme key leaves the previous theme untouched', () => {
    expect(mergeThemeOption(prev, false, undefined)).toBe(prev);
  });
});
