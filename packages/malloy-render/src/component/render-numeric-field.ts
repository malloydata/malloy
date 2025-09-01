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
  } else if (tag.has('number'))
    displayValue = format(tag.text('number') ?? '#', value);
  else displayValue = (value as number).toLocaleString();
  return displayValue;
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

  // Fall back to default time string rendering
  return renderTimeString(value, options);
}
