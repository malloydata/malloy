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
import {Explore, Field} from '@malloydata/malloy';

function getLocationInParent(f: Field | Explore) {
  const parent = f.parentExplore;
  return parent?.allFields.findIndex(pf => pf.name === f.name) ?? -1;
}

export function isLastChild(f: Field | Explore) {
  if (f.parentExplore)
    return getLocationInParent(f) === f.parentExplore.allFields.length - 1;
  return true;
}

export function isFirstChild(f: Field | Explore) {
  return getLocationInParent(f) === 0;
}

export function valueIsNumber(f: Field, v: unknown): v is number {
  return f.isAtomicField() && f.isNumber() && v !== null;
}

export function valueIsBoolean(f: Field, v: unknown): v is boolean {
  return f.isAtomicField() && f.isBoolean() && v !== null;
}

export function valueIsString(f: Field, s: unknown): s is string {
  return f.isAtomicField() && f.isString() && s !== null;
}

export function valueIsDateTime(f: Field, v: unknown): v is Date {
  return f.isAtomicField() && (f.isDate() || f.isTimestamp()) && v !== null;
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

export function getFieldKey(f: Field | Explore) {
  return JSON.stringify(f.fieldPath);
}

export function getRangeSize(range: [number, number]) {
  return range[1] - range[0] + 1;
}
