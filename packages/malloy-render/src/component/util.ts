/*
 * Copyright 2023 Google LLC
 * Copyright (c) Meta Platforms, Inc. and affiliates.
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
import * as Malloy from '@malloydata/malloy-interfaces';
import {Tag} from '@malloydata/malloy-tag';
import {DurationUnit, isDurationUnit} from '../html/data_styles';
import {format} from 'ssf';
import {Cell, Field, NestField} from './render-result-metadata';
import {renderTimeString} from './render-time';

export const NULL_SYMBOL = '∅';

export function tagFromAnnotations(
  annotations: Malloy.Annotation[] | undefined,
  prefix = '# '
) {
  const tagLines =
    annotations?.map(a => a.value)?.filter(l => l.startsWith(prefix)) ?? [];
  return Tag.fromTagLines(tagLines).tag ?? new Tag();
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

function filterQuote(s: string): string {
  return `'${s.replace(/(['\\])/g, '\\$1')}'`;
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
      '@' + renderTimeString(value.value, value.isDate(), value.field.timeframe)
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
