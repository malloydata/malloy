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

import {
  DataArray,
  DataColumn,
  Explore,
  ExploreField,
  Field,
  QueryData,
  QueryDataRow,
  Result,
  Tag,
} from '@malloydata/malloy';
import {getFieldKey, valueIsNumber, valueIsString} from './util';
import {generateBarChartSpec} from './bar-chart/generate-bar_chart-spec';
import {plotToVega} from './plot/plot-to-vega';
import {hasAny} from './tag-utils';
import {RenderResultMetadata} from './types';
import {shouldRenderAs} from './apply-renderer';

function createDataCache() {
  const dataCache = new WeakMap<DataColumn, QueryData>();
  return {
    get: (cell: DataColumn) => {
      if (!dataCache.has(cell) && cell.isArray()) {
        const data: QueryDataRow[] = [];
        for (const row of cell) {
          data.push(row.toObject());
        }
        dataCache.set(cell, data);
      }
      return dataCache.get(cell)!;
    },
  };
}

export function getResultMetadata(result: Result) {
  const fieldKeyMap: WeakMap<Field | Explore, string> = new WeakMap();
  const getCachedFieldKey = (f: Field | Explore) => {
    if (fieldKeyMap.has(f)) return fieldKeyMap.get(f)!;
    const fieldKey = getFieldKey(f);
    fieldKeyMap.set(f, fieldKey);
    return fieldKey;
  };

  const dataCache = createDataCache();
  const rootField = result.data.field;
  const metadata: RenderResultMetadata = {
    fields: {},
    fieldKeyMap,
    getFieldKey: getCachedFieldKey,
    field: (f: Field | Explore) => metadata.fields[getCachedFieldKey(f)],
    getData: dataCache.get,
    modelTag: result.modelTag,
    resultTag: result.tagParse().tag,
    rootField,
  };

  const fieldKey = metadata.getFieldKey(rootField);
  metadata.fields[fieldKey] = {
    field: rootField,
    min: null,
    max: null,
    minString: null,
    maxString: null,
    values: new Set(),
    maxRecordCt: null,
    renderAs: shouldRenderAs(rootField, result.tagParse().tag),
  };

  initFieldMeta(result.data.field, metadata);
  populateFieldMeta(result.data, metadata);

  Object.values(metadata.fields).forEach(m => {
    const f = m.field;
    // If explore, do some additional post-processing like determining chart settings
    if (f.isExploreField()) populateExploreMeta(f, f.tagParse().tag, metadata);
    else if (f.isExplore())
      populateExploreMeta(f, result.tagParse().tag, metadata);
  });

  return metadata;
}

function initFieldMeta(e: Explore, metadata: RenderResultMetadata) {
  for (const f of e.allFields) {
    const fieldKey = metadata.getFieldKey(f);
    metadata.fields[fieldKey] = {
      field: f,
      min: null,
      max: null,
      minString: null,
      maxString: null,
      values: new Set(),
      maxRecordCt: null,
      renderAs: shouldRenderAs(f),
    };
    if (f.isExploreField()) {
      initFieldMeta(f, metadata);
    }
  }
}

const populateFieldMeta = (data: DataArray, metadata: RenderResultMetadata) => {
  let currExploreRecordCt = 0;
  for (const row of data) {
    currExploreRecordCt++;
    for (const f of data.field.allFields) {
      const value = f.isAtomicField() ? row.cell(f).value : undefined;
      const fieldMeta = metadata.field(f);
      if (valueIsNumber(f, value)) {
        const n = value;
        fieldMeta.min = Math.min(fieldMeta.min ?? n, n);
        fieldMeta.max = Math.max(fieldMeta.max ?? n, n);
      } else if (valueIsString(f, value)) {
        const s = value;
        fieldMeta.values.add(s);
        if (!fieldMeta.minString || fieldMeta.minString.length > s.length)
          fieldMeta.minString = s;
        if (!fieldMeta.maxString || fieldMeta.maxString.length < s.length)
          fieldMeta.maxString = s;
      } else if (f.isExploreField()) {
        const data = row.cell(f);
        if (data.isArray()) populateFieldMeta(data, metadata);
      }
    }
  }
  // root explore
  const rootField = data.field;
  const fieldMeta = metadata.field(rootField);
  fieldMeta.maxRecordCt = Math.max(
    fieldMeta.maxRecordCt ?? currExploreRecordCt,
    currExploreRecordCt
  );
};

function populateExploreMeta(
  f: Explore | ExploreField,
  tag: Tag,
  metadata: RenderResultMetadata
) {
  const fieldMeta = metadata.field(f);
  if (hasAny(tag, 'bar', 'bar_chart')) {
    const plotSpec = generateBarChartSpec(f, tag);
    fieldMeta.vegaChartProps = plotToVega(plotSpec, {
      field: f,
      metadata,
      chartTag: (tag.tag('bar_chart') ?? tag.tag('bar'))!,
    });
  }
}
