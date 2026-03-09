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

import {format} from 'ssf';
import {
  getText,
  NULL_SYMBOL,
  renderTimeString,
  formatBigNumber,
  formatScaledNumber,
  type RenderTimeStringOptions,
} from '../util';
import type {Field, NumberCell} from '../data_tree';
import type {
  CellFormatConfig,
  CurrencyConfig,
  NumberConfig,
} from './tag-configs';

/**
 * Get the CellFormatConfig for a field, with optional override.
 * The override is used for array elements, where the array field's
 * config should be used instead of the element field's config.
 */
function getConfig(
  f: Field,
  configOverride?: CellFormatConfig
): CellFormatConfig {
  return (
    configOverride ?? f.getTagConfig<CellFormatConfig>() ?? {mode: 'default'}
  );
}

/**
 * Renders a numeric field with formatting based on pre-resolved tag config.
 *
 * Supports:
 * - Currency shorthand: # currency=usd2m, # currency=eur0k
 * - Currency verbose: # currency { scale=m decimals=2 suffix=finance }
 * - Number shorthand: # number=1k, # number=0m, # number=auto
 * - Number verbose: # number { scale=m decimals=2 suffix=word }
 * - Legacy: # number=big, # currency=euro
 */
export function renderNumericField(
  f: Field,
  value: number | null | undefined,
  configOverride?: CellFormatConfig
): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }
  const config = getConfig(f, configOverride);

  switch (config.mode) {
    case 'currency':
      return renderCurrencyValue(config.currency, value);
    case 'percent':
      return format('#,##0.00%', value);
    case 'duration': {
      return (
        getText(f, value, {
          durationUnit: config.duration.unit,
          terse: config.duration.terse,
        }) ?? value.toLocaleString()
      );
    }
    case 'number':
      return renderNumberValue(config.number, value);
    default:
      return value.toLocaleString();
  }
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

/**
 * Render a big number value (stored as string for precision).
 * Used when NumberCell.stringValue is defined (bigint/bigdecimal subtypes).
 */
export function renderBigNumberField(
  f: Field,
  value: string | null | undefined,
  configOverride?: CellFormatConfig
): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }
  const config = getConfig(f, configOverride);

  switch (config.mode) {
    case 'currency':
      return formatBigIntCurrency(config.currency, value);
    case 'percent':
    case 'duration':
      // These require numeric operations - lossy for bigints (rare use case)
      return renderNumericField(f, Number(value), config);
    case 'number':
      return formatBigIntNumber(config.number, value);
    default:
      return formatStringWithCommas(value);
  }
}

/**
 * Render a NumberCell for display, automatically handling bigint precision.
 *
 * USE THIS FUNCTION when rendering numeric values from cells in plugins/components.
 *
 * @param cell - A NumberCell from the data tree
 * @param configOverride - Optional config override (e.g., for array elements, use the array field's config)
 */
export function renderNumberCell(
  cell: NumberCell,
  configOverride?: CellFormatConfig
): string {
  if (cell.stringValue !== undefined) {
    return renderBigNumberField(cell.field, cell.stringValue, configOverride);
  }
  return renderNumericField(cell.field, cell.value, configOverride);
}

export function renderDateTimeField(
  f: Field,
  value: Date | null | undefined,
  options: RenderTimeStringOptions = {},
  configOverride?: CellFormatConfig
): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }

  const config = getConfig(f, configOverride);

  // Check if the field has a date format from # number tag
  if (config.mode === 'dateFormat') {
    try {
      return format(config.formatString, value);
    } catch (error) {
      // If the format fails, fall back to default formatting
      // eslint-disable-next-line no-console
      console.warn(
        `Invalid date format "${config.formatString}" for field ${f.name}, falling back to default formatting`
      );
    }
  }

  // Get the effective query timezone for timestamp fields (not date fields)
  const effectiveTimezone = !options.isDate
    ? options.timezone ?? f.getEffectiveQueryTimezone()
    : undefined;

  const optionsWithTimezone = {
    ...options,
    timezone: effectiveTimezone,
  };

  return renderTimeString(value, optionsWithTimezone);
}
