/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// How one value displays: a field's `# currency`, `# percent`, `# duration`
// and `# number` tags resolved to a plain config, and the formatters that
// apply it. No DOM, no data tree, no Solid — this is what the headless
// `@malloydata/render/format` entry exports, and what the renderer's own cells
// call, so a value formatted outside the renderer reads the same as inside it.

import {format} from 'ssf';
import type {Tag} from '@malloydata/malloy-tag';
import {DurationUnit} from '../html/data_styles';
import type {SuffixFormat} from '../html/data_styles';
import {
  formatBigNumber,
  formatScaledNumber,
  normalizeScale,
  parseCurrencyShorthand,
  parseNumberShorthand,
  type ScaleKey,
  type SuffixFormatKey,
} from './number-format';
import {
  formatDuration,
  renderTimeString,
  type RenderTimeStringOptions,
} from './time-format';

export const NULL_SYMBOL = '∅';

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

/** A resolved cell format. Plain data: safe to serialize and pass around. */
export type CellFormatConfig =
  | {mode: 'currency'; currency: CurrencyConfig}
  | {mode: 'percent'}
  | {mode: 'duration'; duration: DurationConfig}
  | {mode: 'number'; number: NumberConfig}
  | {mode: 'dateFormat'; formatString: string}
  | {mode: 'default'};

const DEFAULT_FORMAT: CellFormatConfig = {mode: 'default'};

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

/**
 * Resolve a field's tag to its cell format. `isTime` says the field is a date
 * or timestamp, where `# number="…"` is a date pattern rather than a number
 * one.
 *
 * @example
 * resolveCellFormat(tagOf('# currency=usd0k'), {isTime: false})
 * // {mode: 'currency', currency: {symbol: '$', scale: 'k', decimals: 0, …}}
 */
export function resolveCellFormat(
  tag: Tag,
  options: {isTime?: boolean} = {}
): CellFormatConfig {
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
    if (options.isTime) {
      const numberFormat = tag.text('number');
      if (numberFormat) {
        return {mode: 'dateFormat', formatString: numberFormat};
      }
    }
    return {mode: 'number', number: resolveNumberConfig(tag)};
  }

  return DEFAULT_FORMAT;
}

/**
 * Format one number for display.
 *
 * `value` may be a string of digits: that is how the stable API carries a
 * bigint or big decimal exactly, and it is formatted without passing through a
 * JS number wherever the format allows.
 */
export function formatNumber(
  value: number | string | null | undefined,
  config: CellFormatConfig = DEFAULT_FORMAT
): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }
  if (typeof value === 'string') {
    return formatBigNumberString(value, config);
  }

  switch (config.mode) {
    case 'currency':
      return renderCurrencyValue(config.currency, value);
    case 'percent':
      return format('#,##0.00%', value);
    case 'duration':
      return formatDuration(value, {
        durationUnit: config.duration.unit,
        terse: config.duration.terse,
      });
    case 'number':
      return renderNumberValue(config.number, value);
    default:
      return value.toLocaleString();
  }
}

/**
 * Format one date or timestamp for display. A `# number="…"` date pattern
 * wins; otherwise the value prints at its `timeframe`'s grain, in `timezone`
 * when one is given.
 */
export function formatDateTime(
  value: Date | null | undefined,
  config: CellFormatConfig = DEFAULT_FORMAT,
  options: RenderTimeStringOptions = {}
): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }

  if (config.mode === 'dateFormat') {
    try {
      return format(config.formatString, value);
    } catch (error) {
      // If the format fails, fall back to default formatting
      // eslint-disable-next-line no-console
      console.warn(
        `Invalid date format "${config.formatString}", falling back to default formatting`
      );
    }
  }

  return renderTimeString(value, options);
}

/**
 * Renders a currency value using pre-resolved config.
 */
function renderCurrencyValue(config: CurrencyConfig, value: number): string {
  if (config.scale) {
    const scaledStr = formatScaledNumber(value, {
      scale: config.scale,
      decimals: config.decimals ?? 2,
      suffix: config.suffixFormat,
    });
    return `${config.symbol}${scaledStr}`;
  } else {
    const effectiveDecimals = config.decimals ?? 2;
    const formatStr =
      effectiveDecimals > 0
        ? `${config.symbol}#,##0.${'0'.repeat(effectiveDecimals)}`
        : `${config.symbol}#,##0`;
    return format(formatStr, value);
  }
}

/**
 * Renders a number value using pre-resolved config.
 */
function renderNumberValue(config: NumberConfig, value: number): string {
  if (config.isId) {
    return String(value);
  }

  if (config.scale) {
    return formatScaledNumber(value, {
      scale: config.scale,
      decimals: config.decimals ?? 2,
      suffix: config.suffixFormat ?? 'lower',
    });
  }

  if (config.decimals !== undefined && !config.scale) {
    return Number(value.toFixed(config.decimals)).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: config.decimals,
    });
  }

  if (config.isBig) {
    return formatBigNumber(value);
  }

  if (config.formatString) {
    return format(config.formatString, value);
  }

  return format('#', value);
}

/**
 * Format a string number with locale-style comma separators.
 * Preserves full precision (no conversion to JS number).
 */
function formatStringWithCommas(value: string): string {
  const isNegative = value.startsWith('-');
  const absValue = isNegative ? value.slice(1) : value;
  const formatted = absValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format a bigint string as currency with pre-resolved config.
 */
function formatBigIntCurrency(config: CurrencyConfig, value: string): string {
  if (config.scale) {
    const numericValue = Number(value);
    const scaledStr = formatScaledNumber(numericValue, {
      scale: config.scale,
      decimals: config.decimals ?? 2,
      suffix: config.suffixFormat,
    });
    return `${config.symbol}${scaledStr}`;
  }

  const effectiveDecimals = config.decimals ?? 2;
  if (effectiveDecimals === 0) {
    return `${config.symbol}${formatStringWithCommas(value)}`;
  }
  return `${config.symbol}${formatStringWithCommas(value)}.${'0'.repeat(effectiveDecimals)}`;
}

/**
 * Format a bigint string as number with pre-resolved config.
 */
function formatBigIntNumber(config: NumberConfig, value: string): string {
  if (config.isId) {
    return value;
  }

  if (config.scale) {
    return formatScaledNumber(Number(value), {
      scale: config.scale,
      decimals: config.decimals ?? 2,
      suffix: config.suffixFormat ?? 'lower',
    });
  }

  if (config.decimals !== undefined && !config.scale) {
    if (config.decimals === 0) {
      return formatStringWithCommas(value);
    }
    return `${formatStringWithCommas(value)}.${'0'.repeat(config.decimals)}`;
  }

  if (config.isBig) {
    return formatBigNumber(Number(value));
  }

  if (config.formatString) {
    return format(config.formatString, Number(value));
  }

  return formatStringWithCommas(value);
}

function formatBigNumberString(
  value: string,
  config: CellFormatConfig
): string {
  switch (config.mode) {
    case 'currency':
      return formatBigIntCurrency(config.currency, value);
    case 'percent':
    case 'duration':
      // These require numeric operations - lossy for bigints (rare use case)
      return formatNumber(Number(value), config);
    case 'number':
      return formatBigIntNumber(config.number, value);
    default:
      return formatStringWithCommas(value);
  }
}
