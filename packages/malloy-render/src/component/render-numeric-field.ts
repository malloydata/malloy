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

import {DurationUnit} from '../html/data_styles';
import type {SuffixFormat} from '../html/data_styles';
import {format} from 'ssf';
import {
  getText,
  NULL_SYMBOL,
  renderTimeString,
  formatBigNumber,
  formatScaledNumber,
  parseNumberShorthand,
  parseCurrencyShorthand,
  normalizeScale,
  type RenderTimeStringOptions,
  type ScaleKey,
  type SuffixFormatKey,
} from '../util';
import type {Field, NumberCell} from '../data_tree';
import type {Tag} from '@malloydata/malloy-tag';

/**
 * Renders a numeric field with formatting based on tags.
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
  tagOverride?: Tag
): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }
  const tag = tagOverride ?? f.tag;

  // Handle currency formatting
  if (tag.has('currency')) {
    return renderCurrencyField(tag, value);
  }

  // Handle percent formatting
  if (tag.has('percent')) {
    return format('#,##0.00%', value);
  }

  // Handle duration formatting
  if (tag.has('duration')) {
    const durationUnit = tag.text('duration');
    const targetUnit = durationUnit ?? DurationUnit.Seconds;
    return (
      getText(f, value, {durationUnit: targetUnit}) ?? value.toLocaleString()
    );
  }

  // Handle number formatting
  if (tag.has('number')) {
    return renderNumberField(tag, value);
  }

  // Default: locale string
  return value.toLocaleString();
}

/**
 * Parsed currency format options from a tag.
 */
interface CurrencyFormatOptions {
  symbol: string;
  scale?: ScaleKey | 'auto';
  decimals?: number;
  suffixFormat: SuffixFormatKey;
}

/**
 * Parses currency format options from a tag.
 * Supports both shorthand (e.g., "usd2m") and verbose syntax (e.g., { scale=k decimals=0 }).
 */
function parseCurrencyFormatOptions(tag: Tag): CurrencyFormatOptions {
  const currencyValue = tag.text('currency');

  // Try parsing as shorthand format (e.g., "usd2m", "eur0k")
  const shorthand = currencyValue
    ? parseCurrencyShorthand(currencyValue)
    : null;

  let symbol = '$';
  let scale: ScaleKey | 'auto' | undefined;
  let decimals: number | undefined;
  let suffixFormat: SuffixFormatKey = 'lower'; // Default for shorthand

  if (shorthand) {
    // Shorthand format parsed successfully
    symbol = shorthand.symbol;
    scale = shorthand.scale;
    decimals = shorthand.decimals;
  } else {
    // Try legacy/verbose format
    // Currency type: usd, euro, pound
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

    // Get scale from verbose syntax
    const scaleTag = tag.text('currency', 'scale');
    scale = normalizeScale(scaleTag);

    // Get decimals from verbose syntax
    decimals = tag.numeric('currency', 'decimals') ?? undefined;

    // Get suffix format from verbose syntax
    const suffixTag = tag.text('currency', 'suffix') as
      | SuffixFormat
      | undefined;
    if (suffixTag) {
      suffixFormat = suffixTag as SuffixFormatKey;
    } else if (scale) {
      // Default to 'letter' for verbose syntax with scale
      suffixFormat = 'letter';
    }
  }

  return {symbol, scale, decimals, suffixFormat};
}

/**
 * Renders a currency field with support for shorthand and verbose syntax.
 */
function renderCurrencyField(tag: Tag, value: number): string {
  const {symbol, scale, decimals, suffixFormat} =
    parseCurrencyFormatOptions(tag);

  // Apply scaling and formatting
  if (scale) {
    // Use formatScaledNumber for scaled values
    const scaledStr = formatScaledNumber(value, {
      scale,
      decimals: decimals ?? 2,
      suffix: suffixFormat,
    });
    return `${symbol}${scaledStr}`;
  } else {
    // No scaling - use standard currency format
    const effectiveDecimals = decimals ?? 2;
    const formatStr =
      effectiveDecimals > 0
        ? `${symbol}#,##0.${'0'.repeat(effectiveDecimals)}`
        : `${symbol}#,##0`;
    return format(formatStr, value);
  }
}

/**
 * Renders a number field with support for shorthand and verbose syntax.
 */
function renderNumberField(tag: Tag, value: number): string {
  const numberValue = tag.text('number');

  // Try parsing as shorthand format (e.g., "1k", "0m", "auto", "big", "id")
  const shorthand = numberValue ? parseNumberShorthand(numberValue) : null;

  if (shorthand) {
    // Shorthand format parsed successfully
    if (shorthand.isId) {
      // ID format - no commas, just the raw number
      return String(value);
    } else if (shorthand.scale) {
      // Has scale - use formatScaledNumber
      return formatScaledNumber(value, {
        scale: shorthand.scale,
        decimals: shorthand.decimals ?? 2,
        suffix: 'lower', // Default for shorthand
      });
    } else if (shorthand.decimals !== undefined) {
      // Just decimals, no scale - use toFixed
      return Number(value.toFixed(shorthand.decimals)).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: shorthand.decimals,
      });
    }
  }

  // Check for verbose syntax with scale
  const scaleTag = tag.text('number', 'scale');
  const scale = normalizeScale(scaleTag);

  if (scale) {
    // Verbose syntax with scale
    const decimals = tag.numeric('number', 'decimals') ?? 2;
    const suffixTag = tag.text('number', 'suffix') as SuffixFormat | undefined;
    const suffixFormat: SuffixFormatKey =
      (suffixTag as SuffixFormatKey) ?? 'letter';

    return formatScaledNumber(value, {
      scale,
      decimals,
      suffix: suffixFormat,
    });
  }

  // Legacy: # number=big
  if (numberValue === 'big') {
    return formatBigNumber(value);
  }

  // SSF format string (e.g., "#,##0.00")
  if (numberValue) {
    return format(numberValue, value);
  }

  // Default
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
 * Format a bigint string as currency with support for scale/decimals/suffix.
 *
 * Note: When scale is specified, this converts to JS number which is lossy
 * for values > 2^53. This is acceptable since scaled values are abbreviated
 * and don't need full precision.
 */
function formatBigIntCurrency(tag: Tag, value: string): string {
  const {symbol, scale, decimals, suffixFormat} =
    parseCurrencyFormatOptions(tag);

  // If scale is specified, convert to number and use formatScaledNumber
  // This is lossy for very large bigints but acceptable for abbreviated display
  if (scale) {
    const numericValue = Number(value);
    const scaledStr = formatScaledNumber(numericValue, {
      scale,
      decimals: decimals ?? 2,
      suffix: suffixFormat,
    });
    return `${symbol}${scaledStr}`;
  }

  // No scaling - format with specified decimals
  const effectiveDecimals = decimals ?? 2;
  if (effectiveDecimals === 0) {
    return `${symbol}${formatStringWithCommas(value)}`;
  }
  return `${symbol}${formatStringWithCommas(value)}.${'0'.repeat(effectiveDecimals)}`;
}

/**
 * Render a big number value (stored as string for precision).
 * Used when NumberCell.stringValue is defined (bigint/bigdecimal subtypes).
 * Default formatting preserves full precision with comma separators.
 *
 * Note: percent, duration, scale, and custom number formats are lossy for values > 2^53
 * because they require numeric operations. This is acceptable for abbreviated display.
 */
export function renderBigNumberField(
  f: Field,
  value: string | null | undefined,
  tagOverride?: Tag
): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }
  const tag = tagOverride ?? f.tag;

  // Currency with full scale/decimals/suffix support
  if (tag.has('currency')) {
    return formatBigIntCurrency(tag, value);
  }

  // Percent/duration require numeric operations - lossy for bigints (rare use case)
  if (tag.has('percent') || tag.has('duration')) {
    return renderNumericField(f, Number(value), tag);
  }

  // Number formatting with scale/decimals support
  if (tag.has('number')) {
    return formatBigIntNumber(tag, value);
  }

  // Default: comma-formatted string (preserves precision)
  return formatStringWithCommas(value);
}

/**
 * Format a bigint string as number with support for scale/decimals/suffix.
 *
 * Note: When scale is specified, this converts to JS number which is lossy
 * for values > 2^53. This is acceptable since scaled values are abbreviated.
 */
function formatBigIntNumber(tag: Tag, value: string): string {
  const numberValue = tag.text('number');

  // Try parsing as shorthand format (e.g., "1k", "0m", "auto", "id")
  const shorthand = numberValue ? parseNumberShorthand(numberValue) : null;

  if (shorthand) {
    if (shorthand.isId) {
      // ID format - no commas, just the raw number
      return value;
    } else if (shorthand.scale) {
      // Has scale - use formatScaledNumber (lossy but abbreviated)
      return formatScaledNumber(Number(value), {
        scale: shorthand.scale,
        decimals: shorthand.decimals ?? 2,
        suffix: 'lower',
      });
    } else if (shorthand.decimals !== undefined) {
      // Just decimals, no scale
      if (shorthand.decimals === 0) {
        return formatStringWithCommas(value);
      }
      return `${formatStringWithCommas(value)}.${'0'.repeat(shorthand.decimals)}`;
    }
  }

  // Check for verbose syntax with scale
  const scaleTag = tag.text('number', 'scale');
  const scale = normalizeScale(scaleTag);

  if (scale) {
    const decimals = tag.numeric('number', 'decimals') ?? 2;
    const suffixTag = tag.text('number', 'suffix') as SuffixFormat | undefined;
    const suffixFormat: SuffixFormatKey =
      (suffixTag as SuffixFormatKey) ?? 'letter';

    return formatScaledNumber(Number(value), {
      scale,
      decimals,
      suffix: suffixFormat,
    });
  }

  // Legacy: # number=big
  if (numberValue === 'big') {
    return formatBigNumber(Number(value));
  }

  // SSF format string (e.g., "#,##0.00") - lossy
  if (numberValue) {
    return format(numberValue, Number(value));
  }

  // Default: comma-formatted string (preserves precision)
  return formatStringWithCommas(value);
}

/**
 * Render a NumberCell for display, automatically handling bigint precision.
 *
 * USE THIS FUNCTION when rendering numeric values from cells in plugins/components.
 *
 * Why this exists:
 * - NumberCell.value is always a JS number, which loses precision for integers > 2^53
 * - NumberCell.stringValue preserves full precision for bigint fields
 * - This function automatically picks the right representation
 *
 * Example:
 *   import {renderNumberCell} from '@/component/render-numeric-field';
 *   const displayValue = renderNumberCell(cell);
 *
 * @param cell - A NumberCell from the data tree
 * @param tagOverride - Optional tag to use for formatting (e.g., for array elements, use the array field's tag)
 * @returns Formatted string for display, respecting field tags (currency, percent, etc.)
 */
export function renderNumberCell(cell: NumberCell, tagOverride?: Tag): string {
  // Use stringValue when available - this preserves precision for bigint fields.
  // For regular numbers, stringValue is undefined and we use the numeric value.
  if (cell.stringValue !== undefined) {
    return renderBigNumberField(cell.field, cell.stringValue, tagOverride);
  }
  return renderNumericField(cell.field, cell.value, tagOverride);
}

export function renderDateTimeField(
  f: Field,
  value: Date | null | undefined,
  options: RenderTimeStringOptions = {},
  tagOverride?: Tag
): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }

  const tag = tagOverride ?? f.tag;

  // Check if the field has a number= tag for custom date formatting
  if (tag.has('number')) {
    const numberFormat = tag.text('number');
    if (numberFormat) {
      try {
        // Use Excel-style date formatting with ssf library
        return format(numberFormat, value);
      } catch (error) {
        // If the format fails, fall back to default formatting
        // eslint-disable-next-line no-console
        console.warn(
          `Invalid date format "${numberFormat}" for field ${f.name}, falling back to default formatting`
        );
      }
    }
  }

  // Get the effective query timezone for timestamp fields (not date fields)
  // Date fields represent calendar dates and shouldn't be timezone-adjusted
  const effectiveTimezone = !options.isDate
    ? options.timezone ?? f.getEffectiveQueryTimezone()
    : undefined;

  const optionsWithTimezone = {
    ...options,
    timezone: effectiveTimezone,
  };

  // Fall back to default time string rendering
  return renderTimeString(value, optionsWithTimezone);
}
