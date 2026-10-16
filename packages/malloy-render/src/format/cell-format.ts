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
import {DateTime} from 'luxon';
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

  return {mode: 'default'};
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
  config: CellFormatConfig = {mode: 'default'}
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
 * The format for a chart axis tick label. A currency with no scale of its own
 * is shortened there (`$1.4M`, `$250K`), because an axis needs to show size,
 * not every digit. A currency the author scaled, and every other format, is
 * unchanged. Tables and tooltips keep the field's own format.
 */
export function axisCellFormat(config: CellFormatConfig): CellFormatConfig {
  if (config.mode === 'currency' && config.currency.scale === undefined) {
    return {
      mode: 'currency',
      currency: {
        symbol: config.currency.symbol,
        scale: 'auto',
        suffixFormat: 'letter',
      },
    };
  }
  return config;
}

export interface FormatDateTimeOptions extends RenderTimeStringOptions {
  /** Named in the warning when the field's date pattern is invalid. */
  fieldName?: string;
}

/**
 * Format one date or timestamp for display. A `# number="…"` date pattern
 * wins; otherwise the value prints at its `timeframe`'s grain.
 *
 * Either way a timestamp reads in `timezone` (the query's, from
 * `query_timezone` in the result) and otherwise in UTC; a date (`isDate`) is
 * always its UTC calendar day. Never the host's zone, so a server and a
 * browser print the same value the same way.
 */
export function formatDateTime(
  value: Date | null | undefined,
  config: CellFormatConfig = {mode: 'default'},
  options: FormatDateTimeOptions = {}
): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }

  if (config.mode === 'dateFormat') {
    try {
      return format(config.formatString, wallClockSerial(value, options));
    } catch (error) {
      // If the format fails, fall back to default formatting
      const field = options.fieldName ? ` for field ${options.fieldName}` : '';
      // eslint-disable-next-line no-console
      console.warn(
        `Invalid date format "${config.formatString}"${field}, falling back to default formatting`
      );
    }
  }

  return renderTimeString(value, options);
}

/** 1970-01-01 as a spreadsheet serial date. */
const EPOCH_SERIAL = 25569;
const MS_PER_DAY = 86_400_000;

/**
 * The value's wall-clock time as a spreadsheet serial date, which is what ssf
 * formats a date pattern from. Handing ssf the Date itself makes it read the
 * Date's LOCAL fields — the host's zone — so "Sep 1 00:00 UTC" printed as
 * "Aug 2026" anywhere west of UTC. A serial carries no zone at all.
 */
function wallClockSerial(value: Date, options: FormatDateTimeOptions): number {
  let wallMs = value.getTime();
  if (options.timezone && !options.isDate) {
    const zoned = DateTime.fromJSDate(value, {zone: options.timezone});
    if (zoned.isValid) {
      // The zone's wall clock, re-read as if it were UTC.
      wallMs += zoned.offset * 60_000;
    }
  }
  return wallMs / MS_PER_DAY + EPOCH_SERIAL;
}

/**
 * Renders a currency value using pre-resolved config.
 */
/** Put the currency symbol after a leading minus: -$3.2M, not $-3.2M. */
function withCurrencySymbol(symbol: string, formatted: string): string {
  return formatted.startsWith('-')
    ? `-${symbol}${formatted.slice(1)}`
    : `${symbol}${formatted}`;
}

function renderCurrencyValue(config: CurrencyConfig, value: number): string {
  if (config.scale) {
    const scaledStr = formatScaledNumber(value, {
      scale: config.scale,
      decimals: config.decimals ?? 2,
      suffix: config.suffixFormat,
    });
    return withCurrencySymbol(config.symbol, scaledStr);
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
    return withCurrencySymbol(config.symbol, scaledStr);
  }

  const effectiveDecimals = config.decimals ?? 2;
  const withCommas = formatStringWithCommas(value);
  if (effectiveDecimals === 0) {
    return withCurrencySymbol(config.symbol, withCommas);
  }
  return withCurrencySymbol(
    config.symbol,
    `${withCommas}.${'0'.repeat(effectiveDecimals)}`
  );
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
