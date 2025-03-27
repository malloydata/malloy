/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import {Tag} from '@malloydata/malloy-tag';
import {DurationUnit, isDurationUnit} from './html/data_styles';
import {format} from 'ssf';
import type {Cell, NestField} from './data_tree';
import {Field} from './data_tree';

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

function padZeros(num: number, length = 2) {
  return `${'0'.repeat(length - 1)}${num}`.slice(-length);
}

export function renderTimeString(
  value: Date,
  isDate: boolean,
  timeframe?: string
) {
  const fullYear = value.getUTCFullYear();
  const fullMonth = padZeros(value.getUTCMonth() + 1);
  const fullDate = padZeros(value.getUTCDate());
  const hours = padZeros(value.getUTCHours());
  const minutes = padZeros(value.getUTCMinutes());
  const seconds = padZeros(value.getUTCSeconds());
  const time = `${hours}:${minutes}:${seconds}`;
  const dateDisplay = `${fullYear}-${fullMonth}-${fullDate}`;
  switch (timeframe) {
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
    default: {
      if (isDate) return dateDisplay;
      return `${dateDisplay} ${time}`;
    }
  }
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
