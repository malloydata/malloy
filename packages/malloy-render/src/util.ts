/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Cell, NestField} from './data_tree';
import {Field} from './data_tree';
import {renderTimeString} from './format/time-format';

// The single-value formatters live in ./format (the headless
// `@malloydata/render/format` entry); re-exported here for existing imports.
export {NULL_SYMBOL} from './format/cell-format';
export * from './format/number-format';
export {
  formatTimeUnit,
  renderTimeString,
  type RenderTimeStringOptions,
} from './format/time-format';

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
