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
import {
  FieldHeaderRangeMap,
  FieldRenderMetadata,
  RenderResultMetadata,
} from '../types';
import {getFieldKey} from '../util';
import {isFieldHidden} from '../../tags_utils';

type LayoutEntry = {
  metadata: FieldRenderMetadata;
  width: number | null;
  height: number | null;
  absoluteColumnRange: [number, number];
  relativeColumnRange: [number, number];
  depth: number;
};

export type TableLayout = {
  fields: Record<string, LayoutEntry>;
  fieldHeaderRangeMap: FieldHeaderRangeMap;
  fieldLayout: (field: Field | Explore) => LayoutEntry;
  totalHeaderSize: number;
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
  explore: Explore,
  start = 0,
  relStart = 0,
  depth = 0
): [FieldHeaderRangeMap, number, number] {
  let fieldMap: FieldHeaderRangeMap = {};

  explore.allFields.forEach(field => {
    if (isFieldHidden(field)) return;
    if (!field.isExploreField()) {
      fieldMap[getFieldKey(field)] = {
        abs: [start, start],
        rel: [relStart, relStart],
        depth,
      };
      start++;
      relStart++;
    } else {
      const [nestedFieldMap, nextStart, nextRelStart] =
        createFieldHeaderRangeMap(field, start, 0, depth + 1);
      fieldMap = {...fieldMap, ...nestedFieldMap};
      fieldMap[getFieldKey(field)] = {
        abs: [start, nextStart - 1],
        rel: [relStart, relStart + nextRelStart - 1],
        depth,
      };
      start = nextStart;
      relStart += nextRelStart;
    }
  });

  return [fieldMap, start, relStart];
}

export function getTableLayout(
  metadata: RenderResultMetadata,
  rootField: Explore
): TableLayout {
  const [fieldHeaderRangeMap] = createFieldHeaderRangeMap(rootField);

  const totalHeaderSize =
    Math.max(...Object.values(fieldHeaderRangeMap).map(f => f.abs[1])) + 1;
  // Populate for root explore
  fieldHeaderRangeMap[getFieldKey(rootField)] = {
    abs: [0, totalHeaderSize - 1],
    rel: [0, totalHeaderSize - 1],
    depth: -1,
  };

  const layout: TableLayout = {
    fields: {},
    fieldHeaderRangeMap,
    fieldLayout(f: Field | Explore) {
      return this.fields[getFieldKey(f)];
    },
    totalHeaderSize,
  };

  for (const [key, fieldMeta] of Object.entries(metadata.fields)) {
    // Only include table fields
    if (!(key in fieldHeaderRangeMap)) continue;

    const field = fieldMeta.field;
    const layoutEntry: LayoutEntry = {
      metadata: fieldMeta,
      width: null,
      height: null,
      absoluteColumnRange: fieldHeaderRangeMap[key].abs,
      relativeColumnRange: fieldHeaderRangeMap[key].rel,
      depth: fieldHeaderRangeMap[key].depth,
    };
    const {tag} = field.tagParse();
    // Allow overriding size
    const textWidth = tag.text('width');
    if (textWidth && NAMED_COLUMN_WIDTHS[textWidth])
      layoutEntry.width = NAMED_COLUMN_WIDTHS[textWidth];
    else if (tag.numeric('width')) layoutEntry.width = tag.numeric('width')!;

    if (tag.numeric('height')) layoutEntry.height = tag.numeric('height')!;

    layout.fields[key] = layoutEntry;
  }

  return layout;
}
