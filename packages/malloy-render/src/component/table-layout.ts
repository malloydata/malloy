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

import {Field} from '@malloydata/malloy';
import {
  FieldRenderMetadata,
  RenderResultMetadata,
} from './render-result-metadata';
import {clamp, getFieldKey, getTextWidth} from './util';
import {renderNumericField} from './render-numeric-field';
import {ChartSettings, getChartSettings} from './chart-settings';

const MIN_COLUMN_WIDTH = 32;
const MAX_COLUMN_WIDTH = 384;
const COLUMN_BUFFER = 12;
// TODO: get from theme
const ROW_HEIGHT = 28;

type LayoutEntry = {
  metadata: FieldRenderMetadata;
  width: number;
  height: number | null;
  chartSettings: ChartSettings | null;
};

export type TableLayout = Record<string, LayoutEntry>;

export function getTableLayout(metadata: RenderResultMetadata): TableLayout {
  const layout = {};

  for (const [key, fieldMeta] of Object.entries(metadata.fields)) {
    const field = fieldMeta.field;
    const layoutEntry: LayoutEntry = {
      metadata: fieldMeta,
      width: getColumnWidth(field, metadata),
      height: null,
      chartSettings: null,
    };

    const {tag} = field.tagParse();
    if (tag.has('bar') && field.isExploreField()) {
      layoutEntry.chartSettings = getChartSettings(field, metadata);
      layoutEntry.width = layoutEntry.chartSettings.totalWidth;
      layoutEntry.height = layoutEntry.chartSettings.totalHeight;
    } else if (field.isAtomicField()) {
      layoutEntry.height = ROW_HEIGHT;
    }

    layout[key] = layoutEntry;
  }
  return layout;
}

function getColumnWidth(f: Field, metadata: RenderResultMetadata) {
  const fieldKey = getFieldKey(f);
  const fieldMeta = metadata.fields[fieldKey];
  let width = 0;
  if (f.isAtomicField()) {
    // TODO: get font styles from theme
    const font = '12px Inter, sans-serif';
    const titleWidth = getTextWidth(f.name, font);
    if (f.isAtomicField() && f.isString()) {
      width =
        Math.max(getTextWidth(fieldMeta.maxString!, font), titleWidth) +
        COLUMN_BUFFER;
    } else if (f.isAtomicField() && f.isNumber() && fieldMeta.max !== null) {
      const formattedValue = renderNumericField(f, fieldMeta.max);
      width =
        Math.max(getTextWidth(formattedValue, font), titleWidth) +
        COLUMN_BUFFER;
    } else width = 130;
    width = clamp(MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, width);
  }

  return width;
}
