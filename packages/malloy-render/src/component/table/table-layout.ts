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

import type {Field, NestField} from '../../data_tree';
import type {FieldHeaderRangeMap} from '../types';

type LayoutEntry = {
  field: Field;
  width: number | null;
  height: number | null;
  absoluteColumnRange: [number, number];
  relativeColumnRange: [number, number];
  depth: number;
};

export type TableLayout = {
  fields: Record<string, LayoutEntry>;
  fieldHeaderRangeMap: FieldHeaderRangeMap;
  fieldLayout: (field: Field) => LayoutEntry;
  totalHeaderSize: number;
  maxDepth: number;
};

const NAMED_COLUMN_WIDTHS = {
  'xs': 28,
  'sm': 64,
  'md': 128,
  'lg': 256,
  'xl': 384,
  '2xl': 512,
};

function createFieldHeaderRangeMap(
  explore: NestField,
  start = 0,
  relStart = 0,
  depth = 0
): [FieldHeaderRangeMap, number, number] {
  let fieldMap: FieldHeaderRangeMap = {};

  explore.fields.forEach(field => {
    if (field.isHidden()) return;
    const key = field.key;
    if (field.isNest()) {
      const [nestedFieldMap, nextStart, nextRelStart] =
        createFieldHeaderRangeMap(field, start, 0, depth + 1);
      fieldMap = {...fieldMap, ...nestedFieldMap};
      fieldMap[key] = {
        abs: [start, nextStart - 1],
        rel: [relStart, relStart + nextRelStart - 1],
        depth,
      };
      start = nextStart;
      relStart += nextRelStart;
    } else {
      fieldMap[key] = {
        abs: [start, start],
        rel: [relStart, relStart],
        depth,
      };
      start++;
      relStart++;
    }
  });

  return [fieldMap, start, relStart];
}

export function getTableLayout(rootField: NestField): TableLayout {
  const [fieldHeaderRangeMap] = createFieldHeaderRangeMap(rootField);

  const totalHeaderSize =
    Math.max(...Object.values(fieldHeaderRangeMap).map(f => f.abs[1])) + 1;
  const key = rootField.key;
  // Populate for root explore
  fieldHeaderRangeMap[key] = {
    abs: [0, totalHeaderSize - 1],
    rel: [0, totalHeaderSize - 1],
    depth: -1,
  };

  const layout: TableLayout = {
    fields: {},
    fieldHeaderRangeMap,
    fieldLayout(f: Field) {
      const key = f.key;
      return this.fields[key];
    },
    totalHeaderSize,
    maxDepth: 0,
  };

  for (const key in fieldHeaderRangeMap) {
    const field = rootField.root().fieldAt(key);
    const layoutEntry: LayoutEntry = {
      field,
      width: null,
      height: null,
      absoluteColumnRange: fieldHeaderRangeMap[key].abs,
      relativeColumnRange: fieldHeaderRangeMap[key].rel,
      depth: fieldHeaderRangeMap[key].depth,
    };
    layout.maxDepth = Math.max(layout.maxDepth, layoutEntry.depth);
    const tag = field.tag;
    const columnTag = tag.tag('column');

    // Allow overriding size
    const textWidth = columnTag?.text('width');
    const numericWidth = columnTag?.numeric('width');
    if (textWidth && NAMED_COLUMN_WIDTHS[textWidth])
      layoutEntry.width = NAMED_COLUMN_WIDTHS[textWidth];
    else if (numericWidth) layoutEntry.width = numericWidth;

    if (columnTag?.numeric('height'))
      layoutEntry.height = columnTag.numeric('height')!;

    layout.fields[key] = layoutEntry;
  }

  return layout;
}
