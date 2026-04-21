/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Tag config types and resolver functions for built-in renderers.
 *
 * Each built-in renderer (image, link, etc.) has a resolver function
 * that reads all tag properties at setup time and returns a typed
 * config object. The component uses this config instead of reading
 * tags directly, ensuring all tag access happens before mounting.
 *
 * This enables headless tag validation (no browser/DOM required)
 * and eliminates the need for BUILTIN_RENDERER_TAGS declarations.
 */

import type {Field} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import {
  parseCurrencyShorthand,
  parseNumberShorthand,
  normalizeScale,
  type ScaleKey,
  type SuffixFormatKey,
} from '@/util';
import {DurationUnit} from '@/html/data_styles';
import type {SuffixFormat} from '@/html/data_styles';

// ---- Image ----

export interface ImageTagConfig {
  width?: string;
  height?: string;
  alt?: string;
  altField?: string;
}

export function resolveImageTags(field: Field): ImageTagConfig {
  const tag = field.tag;
  const imgTag = tag.tag('image');
  if (!imgTag) return {};

  const width = imgTag.text('width');
  const height = imgTag.text('height');

  let alt: string | undefined;
  let altField: string | undefined;
  const altTag = imgTag.tag('alt');
  if (altTag) {
    altField = altTag.text('field');
    if (!altField) {
      alt = altTag.text();
    }
  }

  return {
    width: width ?? undefined,
    height: height ?? undefined,
    alt,
    altField,
  };
}

// ---- Link ----

export interface LinkTagConfig {
  linkField?: string;
  urlTemplate?: string;
}

export function resolveLinkTags(field: Field): LinkTagConfig {
  const tag = field.tag;
  const linkTag = tag.tag('link');
  if (!linkTag) return {};

  return {
    linkField: linkTag.text('field') ?? undefined,
    urlTemplate: linkTag.text('url_template') ?? undefined,
  };
}

// ---- List ----

export interface ListTagConfig {
  isListDetail: boolean;
}

export function resolveListTags(field: Field): ListTagConfig {
  return {
    isListDetail: field.tag.has('list_detail'),
  };
}

// ---- Cell format (numeric, date, duration) ----

export interface CurrencyConfig {
  symbol: string;
  scale?: ScaleKey | 'auto';
  decimals?: number;
  suffixFormat: SuffixFormatKey;
}

export interface NumberConfig {
  formatString?: string;
  scale?: ScaleKey | 'auto';
  decimals?: number;
  suffixFormat?: SuffixFormatKey;
  isId?: boolean;
  isBig?: boolean;
}

export interface DurationConfig {
  unit: string;
  terse: boolean;
}

export type CellFormatConfig =
  | {mode: 'currency'; currency: CurrencyConfig}
  | {mode: 'percent'}
  | {mode: 'duration'; duration: DurationConfig}
  | {mode: 'number'; number: NumberConfig}
  | {mode: 'dateFormat'; formatString: string}
  | {mode: 'default'};

function resolveCurrencyConfig(tag: Tag): CurrencyConfig {
  const currencyValue = tag.text('currency');

  // Try shorthand (e.g., "usd2m", "eur0k")
  const shorthand = currencyValue
    ? parseCurrencyShorthand(currencyValue)
    : null;

  if (shorthand) {
    return {
      symbol: shorthand.symbol,
      scale: shorthand.scale,
      decimals: shorthand.decimals,
      suffixFormat: 'lower',
    };
  }

  // Legacy/verbose
  let symbol = '$';
  switch (currencyValue) {
    case 'euro':
      symbol = '€';
      break;
    case 'pound':
      symbol = '£';
      break;
    case 'usd':
    default:
      symbol = '$';
      break;
  }

  const scaleTag = tag.text('currency', 'scale');
  const scale = normalizeScale(scaleTag);
  const decimals = tag.numeric('currency', 'decimals') ?? undefined;
  const suffixTag = tag.text('currency', 'suffix') as SuffixFormat | undefined;
  let suffixFormat: SuffixFormatKey = 'lower';
  if (suffixTag) {
    suffixFormat = suffixTag as SuffixFormatKey;
  } else if (scale) {
    suffixFormat = 'letter';
  }

  return {symbol, scale, decimals, suffixFormat};
}

function resolveNumberConfig(tag: Tag): NumberConfig {
  const numberValue = tag.text('number');

  // Try shorthand (e.g., "1k", "0m", "auto", "big", "id")
  const shorthand = numberValue ? parseNumberShorthand(numberValue) : null;

  if (shorthand) {
    return {
      scale: shorthand.scale,
      decimals: shorthand.decimals,
      isId: shorthand.isId,
      isBig: false,
      suffixFormat: 'lower',
    };
  }

  // Check verbose syntax
  const scaleTag = tag.text('number', 'scale');
  const scale = normalizeScale(scaleTag);
  if (scale) {
    const decimals = tag.numeric('number', 'decimals') ?? 2;
    const suffixTag = tag.text('number', 'suffix') as SuffixFormat | undefined;
    const suffixFormat: SuffixFormatKey =
      (suffixTag as SuffixFormatKey) ?? 'letter';
    return {scale, decimals, suffixFormat};
  }

  // Legacy or SSF format string
  if (numberValue === 'big') {
    return {isBig: true};
  }

  return {formatString: numberValue ?? undefined};
}

export function resolveCellFormatTags(field: Field): CellFormatConfig {
  const tag = field.tag;

  // Numeric fields
  if (tag.has('currency')) {
    return {mode: 'currency', currency: resolveCurrencyConfig(tag)};
  }
  if (tag.has('percent')) {
    return {mode: 'percent'};
  }
  if (tag.has('duration')) {
    const durationUnit = tag.text('duration');
    const terse = tag.has('duration', 'terse');
    return {
      mode: 'duration',
      duration: {
        unit: durationUnit ?? DurationUnit.Seconds,
        terse,
      },
    };
  }
  if (tag.has('number')) {
    // For date/timestamp fields, # number is a date format
    if (field.isTime()) {
      const numberFormat = tag.text('number');
      if (numberFormat) {
        return {mode: 'dateFormat', formatString: numberFormat};
      }
    }
    return {mode: 'number', number: resolveNumberConfig(tag)};
  }

  return {mode: 'default'};
}

// ---- Column ----

export interface ColumnTagConfig {
  width: number | null;
  height: number | null;
  wordBreak: boolean;
}

const NAMED_COLUMN_WIDTHS: Record<string, number> = {
  'xs': 28,
  'sm': 64,
  'md': 128,
  'lg': 256,
  'xl': 384,
  '2xl': 512,
};

function resolveColumnTags(field: Field): ColumnTagConfig | undefined {
  const columnTag = field.tag.tag('column');
  if (!columnTag) return undefined;

  let width: number | null = null;
  const textWidth = columnTag.text('width');
  const numericWidth = columnTag.numeric('width');
  if (textWidth && NAMED_COLUMN_WIDTHS[textWidth]) {
    width = NAMED_COLUMN_WIDTHS[textWidth];
  } else if (numericWidth) {
    width = numericWidth;
  }

  const height = columnTag.numeric('height') ?? null;
  const wordBreak = columnTag.text('word_break') === 'break_all';

  return {width, height, wordBreak};
}

// ---- Table nest ----

export interface TableNestConfig {
  fillSize: boolean;
  transposeLimit?: number;
  pivotDimensions?: string[];
}

function resolveTableNestTags(field: Field): TableNestConfig {
  const tag = field.tag;

  // table.size for fill mode
  const tableTag = tag.tag('table');
  const sizeTag = tableTag?.tag('size');
  const fillSize = sizeTag?.text() === 'fill';

  // Transpose sub-tags
  let transposeLimit: number | undefined;
  if (tag.has('transpose')) {
    transposeLimit = tag.numeric('transpose', 'limit') ?? undefined;
  }

  // Pivot sub-tags
  let pivotDimensions: string[] | undefined;
  if (tag.has('pivot')) {
    const dims = tag.textArray('pivot', 'dimensions');
    pivotDimensions = dims && dims.length > 0 ? dims : undefined;
  }

  return {fillSize, transposeLimit, pivotDimensions};
}

// ---- Dashboard nest ----

export interface DashboardNestConfig {
  maxTableHeight: number | null;
}

function resolveDashboardTags(field: Field): DashboardNestConfig {
  const tag = field.tag;
  const dashboardTag = tag.tag('dashboard');

  let maxTableHeight: number | null = 361;
  const maxTableHeightTag = dashboardTag?.tag('table', 'max_height');
  if (maxTableHeightTag?.text() === 'none') {
    maxTableHeight = null;
  } else if (maxTableHeightTag?.numeric()) {
    maxTableHeight = maxTableHeightTag.numeric()!;
  }

  return {maxTableHeight};
}

// ---- Resolver dispatch ----

/**
 * Run the appropriate tag resolver for a field based on its renderAs type
 * and store the result on the field. Called during registerFields().
 *
 * Also resolves cross-cutting tag properties (label, column)
 * for ALL fields, ensuring all tag access happens at setup time.
 * Components use the resolved configs instead of reading tags directly.
 */
export function resolveBuiltInTags(field: Field): void {
  const renderAs = field.renderAs();
  const tag = field.tag;

  // Cross-cutting: resolve label for all fields
  const customLabel = tag.text('label');
  if (customLabel !== undefined) {
    field.setResolvedLabel(customLabel);
  }

  // Cross-cutting: resolve column config for all fields
  const columnConfig = resolveColumnTags(field);
  if (columnConfig) {
    field.setColumnConfig(columnConfig);
  }

  // Touch size.height which is read by chart-layout-settings
  // (size and size.width are already read by validateFieldTags)
  const sizeTag = tag.tag('size');
  if (sizeTag) {
    sizeTag.numeric('height');
  }

  // Renderer-specific config
  switch (renderAs) {
    case 'image':
      field.setTagConfig(resolveImageTags(field));
      break;
    case 'link':
      field.setTagConfig(resolveLinkTags(field));
      break;
    case 'list':
      field.setTagConfig(resolveListTags(field));
      break;
    case 'cell':
      field.setTagConfig(resolveCellFormatTags(field));
      break;
    case 'table':
      field.setTagConfig(resolveTableNestTags(field));
      break;
    case 'dashboard':
      field.setTagConfig(resolveDashboardTags(field));
      break;
  }
}
