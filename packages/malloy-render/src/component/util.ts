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
import {Explore, Field, Tag} from '@malloydata/malloy';
import {hasAny} from './tag-utils';

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

export function valueIsString(f: Field, s: unknown): s is string {
  return f.isAtomicField() && f.isString() && s !== null;
}

export function getTextWidth(
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

export function clamp(s: number, e: number, v: number) {
  return Math.max(s, Math.min(e, v));
}

export function shouldRenderAs(f: Field | Explore, tagOverride?: Tag) {
  const tag = tagOverride ?? f.tagParse().tag;
  if (!f.isExplore() && f.isAtomicField()) {
    if (tag.has('link')) return 'link';
    if (tag.has('image')) return 'image';
    return 'cell';
  }
  if (hasAny(tag, 'list', 'list_detail')) return 'list';
  if (hasAny(tag, 'bar_chart')) return 'chart';
  else return 'table';
}

export function getFieldKey(f: Field | Explore) {
  return JSON.stringify(f.fieldPath);
}

export function getRangeSize(range: [number, number]) {
  return range[1] - range[0] + 1;
}
