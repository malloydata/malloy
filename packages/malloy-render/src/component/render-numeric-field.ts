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

import {AtomicField} from '@malloydata/malloy';
import {Currency, DurationUnit} from '../data_styles';
import {format} from 'ssf';

// Map of unit to how many units of the make up the following time unit.
const multiplierMap = new Map<DurationUnit, number>([
  [DurationUnit.Nanoseconds, 1000],
  [DurationUnit.Microseconds, 1000],
  [DurationUnit.Milliseconds, 1000],
  [DurationUnit.Seconds, 60],
  [DurationUnit.Minutes, 60],
  [DurationUnit.Hours, 24],
  [DurationUnit.Days, Number.MAX_VALUE],
]);

function formatTimeUnit(value: number, unit: DurationUnit) {
  let unitString = unit.toString();
  if (value === 1) {
    unitString = unitString.substring(0, unitString.length - 1);
  }
  return `${value} ${unitString}`;
}

export function renderNumericField(f: AtomicField, value: number) {
  let displayValue: string | number = value;
  const {tag} = f.tagParse();
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
          formatTimeUnit(currentUnitValue, unit),
          ...durationParts,
        ];
      }

      if (currentDuration === 0) {
        break;
      }
    }

    if (durationParts.length > 0) {
      displayValue = durationParts.slice(0, 2).join(' ');
    } else displayValue = formatTimeUnit(0, targetUnit as DurationUnit);
  } else if (tag.has('number'))
    displayValue = format(tag.text('number')!, value);
  else displayValue = (value as number).toLocaleString();
  return displayValue;
}
