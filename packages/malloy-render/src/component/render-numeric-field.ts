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

import {Currency, DurationUnit} from '../html/data_styles';
import {format} from 'ssf';
import {
  getText,
  NULL_SYMBOL,
  renderTimeString,
  formatBigNumber,
  type RenderTimeStringOptions,
} from '../util';
import type {Field} from '../data_tree';

export function renderNumericField(
  f: Field,
  value: number | null | undefined
): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }
  let displayValue: string | number = value;
  const tag = f.tag;
  if (tag.has('currency')) {
    let unitText = '$';

    switch (tag.text('currency')) {
      case Currency.Euros:
        unitText = '€';
        break;
      case Currency.Pounds:
        unitText = '£';
        break;
      case Currency.Dollars:
        // Do nothing.
        break;
    }
    displayValue = format(`${unitText}#,##0.00`, value);
  } else if (tag.has('percent')) displayValue = format('#,##0.00%', value);
  else if (tag.has('duration')) {
    const duration_unit = tag.text('duration');
    const targetUnit = duration_unit ?? DurationUnit.Seconds;
    return (
      getText(f, value, {durationUnit: targetUnit}) ?? value.toLocaleString()
    );
  } else if (tag.has('number')) {
    const numberFormat = tag.text('number');
    if (numberFormat === 'big') {
      displayValue = formatBigNumber(value);
    } else {
      displayValue = format(numberFormat ?? '#', value);
    }
  } else displayValue = (value as number).toLocaleString();
  return displayValue;
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
 * Render a big number value (stored as string for precision).
 * Used when NumberCell.stringValue is defined (bigint/bigdecimal subtypes).
 * Default formatting preserves full precision with comma separators.
 * Explicit format tags (currency, percent, etc.) may be lossy for values > 2^53.
 */
export function renderBigNumberField(
  f: Field,
  value: string | null | undefined
): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }
  const tag = f.tag;

  // For formatting that requires numeric conversion (lossy, but user explicitly tagged)
  if (tag.has('currency') || tag.has('percent') || tag.has('duration')) {
    return renderNumericField(f, Number(value));
  }

  // number="big" format with K/M/B/T/Q
  if (tag.has('number') && tag.text('number') === 'big') {
    return formatBigNumber(Number(value));
  }

  // Custom number format (lossy)
  if (tag.has('number')) {
    return format(tag.text('number') ?? '#', Number(value));
  }

  // Default: comma-formatted string (preserves precision)
  return formatStringWithCommas(value);
}

export function renderDateTimeField(
  f: Field,
  value: Date | null | undefined,
  options: RenderTimeStringOptions = {}
): string {
  if (value === null || value === undefined) {
    return NULL_SYMBOL;
  }

  const tag = f.tag;

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
