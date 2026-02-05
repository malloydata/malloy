/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import {Tag, tagFromLines} from '@malloydata/malloy-tag';
import {isTimestampUnit, isDateUnit as _isDateUnit} from '@malloydata/malloy';
import {DurationUnit, isDurationUnit} from './html/data_styles';
import {timeToString as htmlTimeToString} from './html/utils';
import {format} from 'ssf';
import type {Cell, NestField} from './data_tree';
import {Field} from './data_tree';

export const NULL_SYMBOL = '∅';

type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export function deepMerge<T extends Record<string, unknown>[]>(
  ...sources: [...T]
): UnionToIntersection<T[number]> {
  const acc: Record<string, unknown> = {};
  for (const source of sources) {
    if (isObject(source)) {
      for (const key in source) {
        const value = source[key];
        if (isObject(value)) {
          const nextValue = !isObject(acc[key]) ? {} : acc[key];
          acc[key] = deepMerge(nextValue, value);
        } else {
          acc[key] = source[key];
        }
      }
    }
  }
  return acc as UnionToIntersection<T[number]>;
}

function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

export function tagFromAnnotations(
  annotations: Malloy.Annotation[] | undefined,
  prefix = '# '
) {
  const tagLines =
    annotations?.map(a => a.value)?.filter(l => l.startsWith(prefix)) ?? [];
  return tagFromLines(tagLines).tag ?? new Tag();
}

export function renderTagFromAnnotations(
  annotations: Malloy.Annotation[] | undefined
) {
  // Support both '# ' and '#r ' namespaces for render tags
  const defaultTagLines =
    annotations?.map(a => a.value)?.filter(l => l.startsWith('# ')) ?? [];
  const renderTagLines =
    annotations?.map(a => a.value)?.filter(l => l.startsWith('#r ')) ?? [];

  // Merge both namespaces with #r taking precedence (later in array)
  const allLines = [...defaultTagLines, ...renderTagLines];
  return tagFromLines(allLines).tag ?? new Tag();
}

export function getTextWidthCanvas(
  text: string,
  font: string,
  canvasToUse?: HTMLCanvasElement
) {
  const canvas = canvasToUse ?? document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}

export function getTextWidthDOM(text: string, styles: Record<string, string>) {
  const measureDiv = document.createElement('div');
  measureDiv.innerHTML = text;
  for (const [key, value] of Object.entries(styles)) {
    measureDiv.style[key] = value;
  }
  document.body.appendChild(measureDiv);
  const rect = measureDiv.getBoundingClientRect();
  document.body.removeChild(measureDiv);
  return rect.width;
}

export function clamp(s: number, e: number, v: number) {
  return Math.max(s, Math.min(e, v));
}

export function getRangeSize(range: [number, number]) {
  return range[1] - range[0] + 1;
}

export function formatTimeUnit(
  value: number,
  unit: DurationUnit,
  options: {numFormat?: string; terse?: boolean} = {}
) {
  let unitString = unit.toString();
  if (options.terse) {
    unitString = terseDurationUnitsMap.get(unit) ?? unitString;
  } else if (value === 1) {
    unitString = unitString.substring(0, unitString.length - 1);
  }

  const formattedValue = options.numFormat
    ? format(options.numFormat, value)
    : value.toLocaleString();
  return `${formattedValue}${options.terse ? '' : ' '}${unitString}`;
}

const terseDurationUnitsMap = new Map<DurationUnit, string>([
  [DurationUnit.Nanoseconds, 'ns'],
  [DurationUnit.Microseconds, 'µs'],
  [DurationUnit.Milliseconds, 'ms'],
  [DurationUnit.Seconds, 's'],
  [DurationUnit.Minutes, 'm'],
  [DurationUnit.Hours, 'h'],
  [DurationUnit.Days, 'd'],
]);

const multiplierMap = new Map<DurationUnit, number>([
  [DurationUnit.Nanoseconds, 1000],
  [DurationUnit.Microseconds, 1000],
  [DurationUnit.Milliseconds, 1000],
  [DurationUnit.Seconds, 60],
  [DurationUnit.Minutes, 60],
  [DurationUnit.Hours, 24],
  [DurationUnit.Days, Number.MAX_VALUE],
]);

export function getText(
  field: Field,
  value: number,
  options: {
    durationUnit?: string;
  }
): string | null {
  const targetUnit =
    options.durationUnit && isDurationUnit(options.durationUnit)
      ? options.durationUnit
      : DurationUnit.Seconds;
  const tag = field.tag;
  const numFormat = tag.text('number');
  const terse = tag.has('duration', 'terse');

  let currentDuration = value;
  let currentUnitValue = 0;
  let durationParts: string[] = [];
  let foundUnit = false;

  for (const [unit, multiplier] of multiplierMap) {
    if (unit === targetUnit) {
      foundUnit = true;
    }

    if (!foundUnit) {
      continue;
    }

    currentUnitValue = currentDuration % multiplier;
    currentDuration = Math.floor((currentDuration /= multiplier));

    if (currentUnitValue > 0) {
      durationParts = [
        formatTimeUnit(currentUnitValue, unit, {numFormat, terse}),
        ...durationParts,
      ];
    }

    if (currentDuration === 0) {
      break;
    }
  }

  if (durationParts.length > 0) {
    return durationParts.slice(0, 2).join(' ');
  }

  return formatTimeUnit(0, targetUnit, {numFormat, terse});
}

function padZeros(num: number, length = 2) {
  return `${'0'.repeat(length - 1)}${num}`.slice(-length);
}

export interface RenderTimeStringOptions {
  isDate?: boolean;
  timeframe?: string;
  extractFormat?: 'month-day' | 'quarter' | 'month' | 'week' | 'day';
  timezone?: string;
}

export function renderTimeString(
  value: Date,
  options: RenderTimeStringOptions = {}
) {
  // If timezone is provided, use the timezone-aware function
  // For full timestamps without timeframe, default to 'second' granularity
  if (options.timezone) {
    const timeframe =
      options.timeframe && isTimestampUnit(options.timeframe)
        ? options.timeframe
        : 'second';
    return htmlTimeToString(value, timeframe, options.timezone);
  }

  // Handle extraction formats for YoY mode
  if (options.extractFormat) {
    switch (options.extractFormat) {
      case 'month-day':
        return value.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
      case 'month':
        return value.toLocaleDateString('en-US', {
          month: 'long',
          timeZone: 'UTC',
        });
      case 'quarter':
        return `Q${Math.floor(value.getUTCMonth() / 3) + 1}`;
      case 'week':
        return value.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
      case 'day':
        return value.toLocaleDateString('en-US', {
          day: 'numeric',
          timeZone: 'UTC',
        });
    }
  }

  // Original logic
  const fullYear = value.getUTCFullYear();
  const fullMonth = padZeros(value.getUTCMonth() + 1);
  const fullDate = padZeros(value.getUTCDate());
  const hours = padZeros(value.getUTCHours());
  const minutes = padZeros(value.getUTCMinutes());
  const seconds = padZeros(value.getUTCSeconds());
  const time = `${hours}:${minutes}:${seconds}`;
  const dateDisplay = `${fullYear}-${fullMonth}-${fullDate}`;

  // Use type guards for safer timeframe validation
  const timeframe = options.timeframe;
  if (timeframe && isTimestampUnit(timeframe)) {
    switch (timeframe) {
      case 'second': {
        return `${dateDisplay} ${time}`;
      }
      case 'minute': {
        return `${dateDisplay} ${hours}:${minutes}`;
      }
      case 'hour': {
        return `${dateDisplay} ${hours}`;
      }
      case 'day': {
        return `${dateDisplay}`;
      }
      case 'week': {
        return `${dateDisplay}-WK`;
      }
      case 'month': {
        return `${fullYear}-${fullMonth}`;
      }
      case 'quarter': {
        return `${fullYear}-Q${Math.floor(value.getUTCMonth() / 3) + 1}`;
      }
      case 'year': {
        return value.getUTCFullYear().toString();
      }
    }
  }

  // Fallback for unrecognized timeframes or no timeframe
  if (options.isDate) return dateDisplay;
  return `${dateDisplay} ${time}`;
}

function filterQuote(s: string): string {
  return `"${s.replace(/(["\\])/g, '\\$1')}"`;
}

export function valueToMalloy(value: Cell) {
  if (value.isNull()) {
    return 'null';
  } else if (value.isString()) {
    return filterQuote(value.value);
  } else if (value.isNumber()) {
    return value.value.toString();
  } else if (value.isBoolean()) {
    return value.value.toString();
  } else if (value.isTime()) {
    return (
      '@' +
      renderTimeString(value.value, {
        isDate: value.isDate(),
        timeframe: value.field.timeframe,
      })
    );
  } else {
    return 'invalid_drill_literal()';
  }
}

export function walkFields(e: NestField, cb: (f: Field) => void) {
  e.fields.forEach(f => {
    cb(f);
    if (Field.isNestField(f)) {
      walkFields(f, cb);
    }
  });
}

export function notUndefined<T>(x: T | undefined): x is T {
  return x !== undefined;
}

export function formatBigNumber(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  let formattedNumber: string;
  let suffix = '';

  if (absValue >= 1_000_000_000_000_000) {
    formattedNumber = (absValue / 1_000_000_000_000_000).toFixed(1);
    suffix = 'Q';
  } else if (absValue >= 1_000_000_000_000) {
    formattedNumber = (absValue / 1_000_000_000_000).toFixed(1);
    suffix = 'T';
  } else if (absValue >= 1_000_000_000) {
    formattedNumber = (absValue / 1_000_000_000).toFixed(1);
    suffix = 'B';
  } else if (absValue >= 1_000_000) {
    formattedNumber = (absValue / 1_000_000).toFixed(1);
    suffix = 'M';
  } else if (absValue >= 1_000) {
    formattedNumber = (absValue / 1_000).toFixed(1);
    suffix = 'K';
  } else {
    return value.toLocaleString('en-US');
  }

  // Remove trailing .0
  formattedNumber = formattedNumber.replace(/\.0$/, '');

  return `${sign}${formattedNumber}${suffix}`;
}

// ============================================================================
// Unified Number/Currency Scaling
// ============================================================================

// Scale key type (lowercase single letters)
export type ScaleKey = 'k' | 'm' | 'b' | 't' | 'q';

// Suffix format key type
export type SuffixFormatKey =
  | 'letter'
  | 'lower'
  | 'word'
  | 'short'
  | 'finance'
  | 'scientific'
  | 'none';

// Scale configuration
const SCALE_CONFIG: Record<ScaleKey, {divisor: number; threshold: number}> = {
  k: {divisor: 1_000, threshold: 1_000},
  m: {divisor: 1_000_000, threshold: 1_000_000},
  b: {divisor: 1_000_000_000, threshold: 1_000_000_000},
  t: {divisor: 1_000_000_000_000, threshold: 1_000_000_000_000},
  q: {divisor: 1_000_000_000_000_000, threshold: 1_000_000_000_000_000},
};

// Suffix formats for each scale
const SUFFIX_FORMATS: Record<SuffixFormatKey, Record<ScaleKey, string>> = {
  letter: {k: 'K', m: 'M', b: 'B', t: 'T', q: 'Q'},
  lower: {k: 'k', m: 'm', b: 'b', t: 't', q: 'q'},
  word: {
    k: ' Thousand',
    m: ' Million',
    b: ' Billion',
    t: ' Trillion',
    q: ' Quadrillion',
  },
  short: {k: 'K', m: ' Mil', b: ' Bil', t: ' Tril', q: ' Quad'},
  finance: {k: 'M', m: 'MM', b: 'B', t: 'T', q: 'Q'}, // Financial convention
  scientific: {k: '×10³', m: '×10⁶', b: '×10⁹', t: '×10¹²', q: '×10¹⁵'},
  none: {k: '', m: '', b: '', t: '', q: ''},
};

export interface FormatScaledNumberOptions {
  scale?: ScaleKey | 'auto';
  decimals?: number;
  suffix?: SuffixFormatKey;
}

/**
 * Formats a number with scaling and suffix options.
 *
 * @example
 * formatScaledNumber(1234567, { scale: 'm', decimals: 1 }) // "1.2m"
 * formatScaledNumber(1234567, { scale: 'auto' }) // "1.2m"
 * formatScaledNumber(1234567, { scale: 'm', suffix: 'word' }) // "1.2 Million"
 */
export function formatScaledNumber(
  value: number,
  options: FormatScaledNumberOptions = {}
): string {
  const {scale = 'auto', decimals: rawDecimals = 2, suffix = 'lower'} = options;
  const decimals = Math.min(Math.max(0, rawDecimals), 10); // Clamp to 0-10
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  // Determine the scale to use
  let scaleKey: ScaleKey | null = null;
  let divisor = 1;

  if (scale === 'auto') {
    // Auto-scale: pick the largest appropriate scale
    if (absValue >= SCALE_CONFIG.q.threshold) {
      scaleKey = 'q';
      divisor = SCALE_CONFIG.q.divisor;
    } else if (absValue >= SCALE_CONFIG.t.threshold) {
      scaleKey = 't';
      divisor = SCALE_CONFIG.t.divisor;
    } else if (absValue >= SCALE_CONFIG.b.threshold) {
      scaleKey = 'b';
      divisor = SCALE_CONFIG.b.divisor;
    } else if (absValue >= SCALE_CONFIG.m.threshold) {
      scaleKey = 'm';
      divisor = SCALE_CONFIG.m.divisor;
    } else if (absValue >= SCALE_CONFIG.k.threshold) {
      scaleKey = 'k';
      divisor = SCALE_CONFIG.k.divisor;
    } else {
      // No scaling needed - preserve original precision
      return value.toLocaleString('en-US');
    }
  } else {
    // Fixed scale
    scaleKey = scale;
    divisor = SCALE_CONFIG[scale].divisor;
  }

  // Calculate scaled value
  const scaledValue = absValue / divisor;

  // Special handling for scientific notation - use true scientific format
  if (suffix === 'scientific') {
    // Calculate true scientific notation (coefficient between 1 and 10)
    // Add small epsilon to handle floating point precision near powers of 10
    const exponent = Math.floor(Math.log10(absValue) + 1e-10);
    const coefficient = absValue / Math.pow(10, exponent);
    const formattedCoeff = coefficient.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
    const superscriptDigits: Record<string, string> = {
      '0': '⁰',
      '1': '¹',
      '2': '²',
      '3': '³',
      '4': '⁴',
      '5': '⁵',
      '6': '⁶',
      '7': '⁷',
      '8': '⁸',
      '9': '⁹',
      '-': '⁻',
    };
    const superscriptExp = String(exponent)
      .split('')
      .map(d => superscriptDigits[d] || d)
      .join('');
    return `${sign}${formattedCoeff}×10${superscriptExp}`;
  }

  // Format the number with thousand separators
  const formattedNumber = scaledValue.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  // Get the suffix
  const suffixStr = SUFFIX_FORMATS[suffix][scaleKey];

  return `${sign}${formattedNumber}${suffixStr}`;
}

// Currency code to symbol mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  usd: '$',
  eur: '€',
  gbp: '£',
  euro: '€', // Legacy support
  pound: '£', // Legacy support
};

export interface ParsedNumberFormat {
  decimals?: number;
  scale?: ScaleKey | 'auto';
  isId?: boolean; // For identifiers: no commas, no formatting
}

export interface ParsedCurrencyFormat extends ParsedNumberFormat {
  currency: string;
  symbol: string;
}

/**
 * Parses a number shorthand format string.
 * Pattern: {decimals}{scale} or "auto" or "id"
 *
 * @example
 * parseNumberShorthand("1k") // { decimals: 1, scale: 'k' }
 * parseNumberShorthand("0m") // { decimals: 0, scale: 'm' }
 * parseNumberShorthand("2")  // { decimals: 2 }
 * parseNumberShorthand("auto") // { scale: 'auto' }
 * parseNumberShorthand("id") // { isId: true }
 *
 * Note: "big" is NOT handled here - it's a legacy format handled separately
 * in renderNumberField to preserve backward compatibility with formatBigNumber.
 */
export function parseNumberShorthand(
  format: string
): ParsedNumberFormat | null {
  const normalized = format.toLowerCase().trim();

  // Handle auto scale
  if (normalized === 'auto') {
    return {scale: 'auto', decimals: 2};
  }

  // Handle 'id' format - for identifiers like SKUs, no commas
  if (normalized === 'id') {
    return {isId: true};
  }

  // Pattern: {decimal}{scale} e.g., "1k", "0m", "2b"
  const scaleMatch = normalized.match(/^(\d)([kmbtq])$/i);
  if (scaleMatch) {
    const decimals = parseInt(scaleMatch[1], 10);
    const scale = scaleMatch[2].toLowerCase() as ScaleKey;
    return {decimals, scale};
  }

  // Pattern: {decimal} only e.g., "0", "1", "2"
  const decimalMatch = normalized.match(/^(\d)$/);
  if (decimalMatch) {
    return {decimals: parseInt(decimalMatch[1], 10)};
  }

  return null;
}

/**
 * Parses a currency shorthand format string.
 * Pattern: {currency}{decimals}{scale} e.g., "usd2m", "eur0k", "gbp1b"
 *
 * @example
 * parseCurrencyShorthand("usd2m") // { currency: 'usd', symbol: '$', decimals: 2, scale: 'm' }
 * parseCurrencyShorthand("eur0k") // { currency: 'eur', symbol: '€', decimals: 0, scale: 'k' }
 * parseCurrencyShorthand("usd")   // { currency: 'usd', symbol: '$' }
 */
export function parseCurrencyShorthand(
  format: string
): ParsedCurrencyFormat | null {
  const normalized = format.toLowerCase().trim();

  // Try to match currency code at the start
  // Longer patterns first to avoid partial matches (euro before eur)
  const currencyMatch = normalized.match(/^(euro|pound|usd|eur|gbp)/i);
  if (!currencyMatch) {
    return null;
  }

  const currencyCode = currencyMatch[1].toLowerCase();
  const symbol = CURRENCY_SYMBOLS[currencyCode];
  if (!symbol) {
    return null;
  }

  const rest = normalized.slice(currencyMatch[1].length);

  // Check for .auto suffix
  if (rest === '.auto') {
    return {currency: currencyCode, symbol, scale: 'auto', decimals: 2};
  }

  // Pattern: {decimals}{scale} e.g., "2m", "0k"
  const scaleMatch = rest.match(/^(\d)([kmbtq])$/i);
  if (scaleMatch) {
    return {
      currency: currencyCode,
      symbol,
      decimals: parseInt(scaleMatch[1], 10),
      scale: scaleMatch[2].toLowerCase() as ScaleKey,
    };
  }

  // Pattern: {decimals} only e.g., "2", "0"
  const decimalMatch = rest.match(/^(\d)$/);
  if (decimalMatch) {
    return {
      currency: currencyCode,
      symbol,
      decimals: parseInt(decimalMatch[1], 10),
    };
  }

  // Currency code only (no decimals or scale)
  if (rest === '') {
    return {currency: currencyCode, symbol};
  }

  return null;
}

/**
 * Normalizes a scale value to a ScaleKey.
 * Supports single-letter scales: k, m, b, t, q, auto.
 */
export function normalizeScale(
  scale: string | undefined
): ScaleKey | 'auto' | undefined {
  if (!scale) return undefined;

  const normalized = scale.toLowerCase().trim();

  // Single letter scales
  if (['k', 'm', 'b', 't', 'q'].includes(normalized)) {
    return normalized as ScaleKey;
  }

  // Auto scale
  if (normalized === 'auto') {
    return 'auto';
  }

  return undefined;
}
