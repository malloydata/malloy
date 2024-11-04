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
  Result,
  Tag,
} from '@malloydata/malloy';
import {
  getFieldKey,
  valueIsDateTime,
  valueIsNumber,
  valueIsString,
} from './util';
import {hasAny} from './tag-utils';
import {
  DataRowWithRecord,
  RenderResultMetadata,
  VegaChartProps,
  VegaConfigHandler,
} from './types';
import {shouldRenderAs} from './apply-renderer';
import {mergeVegaConfigs} from './vega/merge-vega-configs';
import {baseVegaConfig} from './vega/base-vega-config';
import {renderTimeString} from './render-time';
import {generateBarChartVegaSpec} from './bar-chart/generate-bar_chart-vega-spec';
import {createResultStore} from './result-store/result-store';
import {generateLineChartVegaSpec} from './line-chart/generate-line_chart-vega-spec';
import {parse} from 'vega';

function createDataCache() {
  const dataCache = new WeakMap<DataColumn, QueryData>();
  return {
    get: (cell: DataColumn) => {
      if (!dataCache.has(cell) && cell.isArray()) {
        const data: DataRowWithRecord[] = [];
        for (const row of cell) {
          const record = Object.assign({}, row.toObject(), {
            __malloyDataRecord: row,
          });
          data.push(record);
        }
        dataCache.set(cell, data);
      }
      return dataCache.get(cell)!;
    },
  };
}

export type GetResultMetadataOptions = {
  getVegaConfigOverride?: VegaConfigHandler;
};

export function getResultMetadata(
  result: Result,
  options: GetResultMetadataOptions = {}
) {
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
    store: createResultStore(),
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
    maxUniqueFieldValueCounts: new Map(),
    renderAs: shouldRenderAs(rootField, result.tagParse().tag),
  };

  initFieldMeta(result.data.field, metadata);
  populateFieldMeta(result.data, metadata);

  Object.values(metadata.fields).forEach(m => {
    const f = m.field;
    // If explore, do some additional post-processing like determining chart settings
    if (f.isExploreField())
      populateExploreMeta(f, f.tagParse().tag, metadata, options);
    else if (f.isExplore())
      populateExploreMeta(f, result.tagParse().tag, metadata, options);
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
      maxUniqueFieldValueCounts: new Map<string, number>(),
      renderAs: shouldRenderAs(f),
    };
    if (f.isExploreField()) {
      initFieldMeta(f, metadata);
    }
  }
}

const populateFieldMeta = (data: DataArray, metadata: RenderResultMetadata) => {
  let currExploreRecordCt = 0;
  const currentExploreField = data.field;
  const currentExploreFieldMeta = metadata.field(currentExploreField);
  const maxUniqueFieldValueSets = new Map<string, Set<unknown>>();
  data.field.allFields.forEach(f => {
    maxUniqueFieldValueSets.set(getFieldKey(f), new Set());
  });
  for (const row of data) {
    currExploreRecordCt++;
    for (const f of data.field.allFields) {
      const fieldMeta = metadata.field(f);
      const fieldSet = maxUniqueFieldValueSets.get(getFieldKey(f))!;

      const value = f.isAtomicField() ? row.cell(f).value : undefined;

      if (valueIsNumber(f, value)) {
        const n = value;
        fieldMeta.min = Math.min(fieldMeta.min ?? n, n);
        fieldMeta.max = Math.max(fieldMeta.max ?? n, n);
        if (f.isAtomicField() && f.sourceWasDimension()) {
          fieldMeta.values.add(n);
          fieldSet.add(n);
        }
      } else if (valueIsString(f, value)) {
        const s = value;
        fieldMeta.values.add(s);
        fieldSet.add(s);
        if (!fieldMeta.minString || fieldMeta.minString.length > s.length)
          fieldMeta.minString = s;
        if (!fieldMeta.maxString || fieldMeta.maxString.length < s.length)
          fieldMeta.maxString = s;
      } else if (valueIsDateTime(f, value)) {
        const numericValue = Number(value);
        fieldMeta.min = Math.min(fieldMeta.min ?? numericValue, numericValue);
        fieldMeta.max = Math.max(fieldMeta.max ?? numericValue, numericValue);
        const stringValue = renderTimeString(
          value,
          f.isAtomicField() && f.isDate(),
          f.isAtomicField() && (f.isDate() || f.isTimestamp())
            ? f.timeframe
            : undefined
        ).toString();
        if (
          !fieldMeta.minString ||
          fieldMeta.minString.length > stringValue.length
        )
          fieldMeta.minString = stringValue;
        if (
          !fieldMeta.maxString ||
          fieldMeta.maxString.length < stringValue.length
        )
          fieldMeta.maxString = stringValue;

        if (f.isAtomicField() && f.sourceWasDimension()) {
          fieldMeta.values.add(numericValue);
          fieldSet.add(numericValue);
        }
      } else if (f.isExploreField()) {
        const data = row.cell(f);
        if (data.isArray()) populateFieldMeta(data, metadata);
      }
    }
  }

  // Update the max number of unique values for a field in nested explores
  for (const [fieldKey, set] of maxUniqueFieldValueSets) {
    currentExploreFieldMeta.maxUniqueFieldValueCounts.set(
      fieldKey,
      Math.max(
        currentExploreFieldMeta.maxUniqueFieldValueCounts.get(fieldKey) ?? 0,
        set.size
      )
    );
  }

  currentExploreFieldMeta.maxRecordCt = Math.max(
    currentExploreFieldMeta.maxRecordCt ?? currExploreRecordCt,
    currExploreRecordCt
  );
};

function populateExploreMeta(
  f: Explore | ExploreField,
  tag: Tag,
  metadata: RenderResultMetadata,
  options: GetResultMetadataOptions
) {
  const fieldMeta = metadata.field(f);
  let vegaChartProps: VegaChartProps | null = null;
  if (hasAny(tag, 'bar', 'bar_chart')) {
    vegaChartProps = generateBarChartVegaSpec(f, metadata);
  } else if (tag.has('line_chart')) {
    vegaChartProps = generateLineChartVegaSpec(f, metadata);
  }

  if (vegaChartProps) {
    const vegaConfig = mergeVegaConfigs(
      baseVegaConfig(),
      options.getVegaConfigOverride?.(vegaChartProps.chartType) ?? {}
    );
    fieldMeta.vegaChartProps = {
      ...vegaChartProps,
      spec: {
        ...vegaChartProps.spec,
        config: vegaConfig,
      },
    };
    if (fieldMeta.vegaChartProps?.spec)
      fieldMeta.runtime = parse(fieldMeta.vegaChartProps?.spec);
  }
}
