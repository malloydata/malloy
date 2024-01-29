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
  DataRecord,
  Explore,
  Field,
  Result,
} from '@malloydata/malloy';
import {getFieldKey, valueIsNumber, valueIsString} from './util';

export interface FieldRenderMetadata {
  field: Field;
  min: number | null;
  max: number | null;
  minString: string | null;
  maxString: string | null;
  values: Set<string>;
  maxRecordCt: number | null;
}

export interface RenderResultMetadata {
  fields: Record<string, FieldRenderMetadata>;
}

export function getResultMetadata(result: Result) {
  const fieldKeyMap: WeakMap<Field, string> = new WeakMap();
  const getCachedFieldKey = (f: Field) => {
    if (fieldKeyMap.has(f)) return fieldKeyMap.get(f)!;
    const fieldKey = getFieldKey(f);
    fieldKeyMap.set(f, fieldKey);
    return fieldKey;
  };

  const metadata: RenderResultMetadata = {
    fields: {},
  };

  function initFieldMeta(e: Explore) {
    for (const f of e.allFields) {
      const fieldKey = getCachedFieldKey(f);
      metadata.fields[fieldKey] = {
        field: f,
        min: null,
        max: null,
        minString: null,
        maxString: null,
        values: new Set(),
        maxRecordCt: null,
      };
      if (f.isExploreField()) {
        initFieldMeta(f);
      }
    }
  }

  const populateFieldMeta = (
    data: DataArray,
    metadata: RenderResultMetadata,
    cb?: (row: DataRecord) => void
  ) => {
    for (const row of data) {
      cb?.(row);
      for (const f of data.field.allFields) {
        const value = f.isAtomicField() ? row.cell(f).value : undefined;
        const fieldKey = getFieldKey(f);
        const fieldMeta = metadata.fields[fieldKey];
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
          const data = row.cell(f) as DataArray;
          let recordCt = 0;
          populateFieldMeta(data, metadata, () => recordCt++);
          fieldMeta.maxRecordCt = Math.max(
            fieldMeta.maxRecordCt ?? recordCt,
            recordCt
          );
        }
      }
    }
  };

  initFieldMeta(result.data.field);
  populateFieldMeta(result.data, metadata);

  return metadata;
}
