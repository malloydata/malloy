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

import {Tag} from '@malloydata/malloy-tag';
import {
  valueIsDateTime,
  valueIsNumber,
  valueIsBoolean,
  valueIsString,
  tagFor,
  isAtomic,
  wasDimension,
  isDate,
  isTimestamp,
  getFieldTimeframe,
  getCell,
  getCellValue,
  isNest,
  NestFieldInfo,
  getNestFields,
  CellDataValue,
} from './util';
import {
  DataRowWithRecord,
  FieldRenderMetadata,
  ParentFieldRenderMetadata,
  RenderResultMetadata,
  VegaChartProps,
  VegaConfigHandler,
} from './types';
import {
  NULL_SYMBOL,
  shouldRenderAs,
  shouldRenderChartAs,
} from './apply-renderer';
import {mergeVegaConfigs} from './vega/merge-vega-configs';
import {baseVegaConfig} from './vega/base-vega-config';
import {renderTimeString} from './render-time';
import {generateBarChartVegaSpec} from './bar-chart/generate-bar_chart-vega-spec';
import {createResultStore} from './result-store/result-store';
import {generateLineChartVegaSpec} from './line-chart/generate-line_chart-vega-spec';
import {parse, Config} from 'vega';
import * as Malloy from '@malloydata/malloy-interfaces';

// function createDataCache(
//   rootField: NestFieldInfo,
//   data: Malloy.CellWithArrayCell | Malloy.CellWithRecordCell
// ) {
//   const dataCache = new WeakMap<Malloy.Cell, CellDataValue>();
//   const parentMap = new WeakMap<Malloy.Cell, Malloy.Cell | undefined>();
//   const fieldMap = new WeakMap<Malloy.Cell, Malloy.DimensionInfo>();

//   function populate(
//     field: NestFieldInfo,
//     data: Malloy.CellWithArrayCell | Malloy.CellWithRecordCell
//   ) {
//     parentMap.set(data, undefined);
//     fieldMap.set(data, field);
//     const fields = getNestFields(field);
//     const rows = data.kind === 'record_cell' ? [data] : data.array_value;
//     for (const rowCell of rows) {
//       if (rowCell.kind !== 'record_cell') {
//         throw new Error('Invalid record');
//       }
//       const row = rowCell.record_value;
//       for (const child of fields) {
//         const cell = getCell(field, row, child.name);
//         if (isNest(child)) {
//           populate(
//             child,
//             cell as Malloy.CellWithArrayCell | Malloy.CellWithRecordCell
//           );
//         } else {
//           parentMap.set(cell, data);
//           fieldMap.set(cell, child);
//         }
//       }
//     }
//   }
//   populate(rootField, data);

//   return {
//     get: (cell: Malloy.Cell) => {
//       if (!dataCache.has(cell)) {
//         const data: DataRowWithRecord[] = [];
//         const fields = parent.schema.fields;
//         for (const row of cell.table_value.rows) {
//           const record = {__malloyDataRecord: row}; // TODO remove this
//           for (const field of fields) {
//             const cell = getCell(parent, row, field.name);
//             const value = getCellValue(cell);
//             // TODO: can we store Date objects as is? Downstream chart code would need to be updated
//             record[field.name] =
//               value instanceof Date ? value.valueOf() : value;
//           }
//           data.push(record as DataRowWithRecord);
//         }
//         dataCache.set(cell, data);
//       }
//       return dataCache.get(cell)!;
//     },
//   };
// }

export type GetResultMetadataOptions = {
  getVegaConfigOverride?: VegaConfigHandler;
};

export function getResultMetadata(
  result: Malloy.Result,
  options: GetResultMetadataOptions = {}
) {
  // const dataCache = createDataCache();
  const fields: Malloy.DimensionInfo[] = [];
  for (const field of result.schema.fields) {
    if (field.kind === 'dimension') {
      fields.push(field);
    }
  }
  const rootField: NestFieldInfo = {
    name: 'root',
    type: {
      kind: 'array_type',
      element_type: {
        kind: 'record_type',
        fields,
      },
    },
    annotations: result.annotations,
  };
  const resultTag = new Tag(); // TODO
  const metadata: RenderResultMetadata = {
    fields: new Map(),
    fieldsByKey: new Map(),
    // getData: dataCache.get,
    modelTag: new Tag(), // TODO
    resultTag,
    store: createResultStore(),
    rootField,
    sourceName: 'foo', // TODO
  };

  const rootMetadata: FieldRenderMetadata = {
    field: rootField,
    min: null,
    max: null,
    minString: null,
    maxString: null,
    values: new Set(),
    maxRecordCt: null,
    maxUniqueFieldValueCounts: new Map(),
    renderAs: shouldRenderAs(rootField),
    path: [],
    parent: undefined,
    key: '',
  };
  metadata.fields.set(rootField, rootMetadata);
  metadata.fieldsByKey.set(rootMetadata.key, rootField);

  // console.log({theResult: result});
  initFieldMeta(rootField, [], metadata);
  if (result.data === undefined) {
    throw new Error('Expected result to have data');
  }
  populateFieldMeta(result.data, rootField, metadata);
  // console.log({metadata});

  [...metadata.fields.values()].forEach(m => {
    const f = m.field;
    // If explore, do some additional post-processing like determining chart settings
    if (isNest(f)) populateExploreMeta(f, tagFor(f), metadata, options);
  });

  return metadata;
}

function initFieldMeta(
  e: NestFieldInfo,
  path: string[],
  metadata: RenderResultMetadata
) {
  for (const f of getNestFields(e)) {
    const parentMetadata = metadata.fields.get(e);
    const newPath = [...path, f.name];
    const fieldMetadata: FieldRenderMetadata = {
      field: f,
      min: null,
      max: null,
      minString: null,
      maxString: null,
      values: new Set(),
      maxRecordCt: null,
      maxUniqueFieldValueCounts: new Map(),
      renderAs: shouldRenderAs(f),
      path: newPath,
      parent: parentMetadata as ParentFieldRenderMetadata,
      key: newPath.join('.'),
    };
    metadata.fields.set(f, fieldMetadata);
    metadata.fieldsByKey.set(fieldMetadata.key, f);
    if (isNest(f)) {
      initFieldMeta(f, newPath, metadata);
    }
  }
}

const populateFieldMeta = (
  data: Malloy.Cell,
  field: NestFieldInfo,
  metadata: RenderResultMetadata
) => {
  let currExploreRecordCt = 0;
  const currentExploreField = field;
  const currentExploreFieldMeta = metadata.fields.get(currentExploreField)!;
  const maxUniqueFieldValueSets = new Map<Malloy.DimensionInfo, Set<unknown>>();
  const nestFields = getNestFields(field);
  nestFields.forEach(f => {
    maxUniqueFieldValueSets.set(f, new Set());
  });
  if (data.kind !== 'array_cell') {
    throw new Error('Expected table data here'); // TODO what about a query with all measures?
  }
  for (const row of data.array_value) {
    if (row.kind !== 'record_cell') {
      throw new Error('Expected record data here');
    }
    currExploreRecordCt++;
    for (const f of nestFields) {
      const fieldMeta = metadata.fields.get(f)!;
      const fieldSet = maxUniqueFieldValueSets.get(f)!;

      const value = isAtomic(f)
        ? getCellValue(getCell(field, row.record_value, f.name))
        : undefined;
      if (isAtomic(f) && (value === null || typeof value === 'undefined')) {
        fieldMeta.values.add(NULL_SYMBOL);
        fieldSet.add(NULL_SYMBOL);
      } else if (valueIsNumber(f, value)) {
        const n = value;
        fieldMeta.min = Math.min(fieldMeta.min ?? n, n);
        fieldMeta.max = Math.max(fieldMeta.max ?? n, n);
        if (isAtomic(f) && wasDimension(f)) {
          fieldMeta.values.add(n);
          fieldSet.add(n);
        }
      } else if (valueIsBoolean(f, value)) {
        const bool: boolean = value;
        if (isAtomic(f) && wasDimension(f)) {
          fieldMeta.values.add(bool);
          fieldSet.add(bool);
        }
        if (!fieldMeta.minString || fieldMeta.minString.length > 4)
          fieldMeta.minString = 'true';
        if (!fieldMeta.maxString || fieldMeta.maxString.length < 5)
          fieldMeta.maxString = 'false';
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
          isAtomic(f) && isDate(f),
          isAtomic(f) && (isDate(f) || isTimestamp(f))
            ? getFieldTimeframe(f)
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

        if (isAtomic(f) && wasDimension(f)) {
          fieldMeta.values.add(numericValue);
          fieldSet.add(numericValue);
        }
      } else if (isNest(f)) {
        const data = getCell(field, row.record_value, f.name);
        if (data.kind === 'array_cell') populateFieldMeta(data, f, metadata);
      }
    }
  }

  // Update the max number of unique values for a field in nested explores
  for (const [field, set] of maxUniqueFieldValueSets) {
    currentExploreFieldMeta.maxUniqueFieldValueCounts.set(
      field,
      Math.max(
        currentExploreFieldMeta.maxUniqueFieldValueCounts.get(field) ?? 0,
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
  f: NestFieldInfo,
  tag: Tag,
  metadata: RenderResultMetadata,
  options: GetResultMetadataOptions
) {
  const fieldMeta = metadata.fields.get(f)!;
  let vegaChartProps: VegaChartProps | null = null;
  const chartType = shouldRenderChartAs(tag);
  if (chartType === 'bar_chart') {
    vegaChartProps = generateBarChartVegaSpec(f, metadata);
  } else if (chartType === 'line_chart') {
    vegaChartProps = generateLineChartVegaSpec(f, metadata);
  }
  if (f.name === 'ySeries') console.log({vegaChartProps});

  if (vegaChartProps) {
    const vegaConfigOverride =
      options.getVegaConfigOverride?.(vegaChartProps.chartType) ?? {};

    const vegaConfig: Config = mergeVegaConfigs(
      baseVegaConfig(),
      options.getVegaConfigOverride?.(vegaChartProps.chartType) ?? {}
    );

    const maybeAxisYLabelFont = vegaConfigOverride['axisY']?.['labelFont'];
    const maybeAxisLabelFont = vegaConfigOverride['axis']?.['labelFont'];
    if (maybeAxisYLabelFont || maybeAxisLabelFont) {
      const refLineFontSignal = vegaConfig.signals?.find(
        signal => signal.name === 'referenceLineFont'
      );
      if (refLineFontSignal)
        refLineFontSignal.value = maybeAxisYLabelFont ?? maybeAxisLabelFont;
    }

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
