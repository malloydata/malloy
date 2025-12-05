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
import type {PivotConfig} from './pivot-utils';

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

/**
 * Adjusts a table layout to account for pivot column expansion.
 * Pivot fields may have more columns than their original nested structure.
 *
 * @param layout The original table layout
 * @param pivotConfigs Map of field keys to their pivot configurations
 * @returns Adjusted layout with correct column counts for pivot fields
 */
export function adjustLayoutForPivots(
  layout: TableLayout,
  pivotConfigs: Map<string, PivotConfig>
): TableLayout {
  if (pivotConfigs.size === 0) {
    return layout;
  }

  // Calculate column adjustments needed for each pivot field
  const adjustments: Array<{startCol: number; delta: number}> = [];

  for (const [fieldKey, pivotConfig] of pivotConfigs) {
    const fieldRange = layout.fieldHeaderRangeMap[fieldKey];
    if (!fieldRange) continue;

    const currentCols = fieldRange.abs[1] - fieldRange.abs[0] + 1;
    const neededCols = pivotConfig.columnFields.length;
    const delta = neededCols - currentCols;

    if (delta !== 0) {
      adjustments.push({
        startCol: fieldRange.abs[0],
        delta,
      });
    }
  }

  if (adjustments.length === 0) {
    return layout;
  }

  // Sort adjustments by start column (process from left to right)
  adjustments.sort((a, b) => a.startCol - b.startCol);

  // Create new field header range map with adjusted columns
  const newFieldHeaderRangeMap: FieldHeaderRangeMap = {};

  for (const key in layout.fieldHeaderRangeMap) {
    const range = layout.fieldHeaderRangeMap[key];
    const [absStart] = range.abs;
    let absEnd = range.abs[1];
    const [relStart] = range.rel;
    let relEnd = range.rel[1];

    // Calculate cumulative adjustment for this field's position
    let cumulativeAdjustment = 0;
    for (const adj of adjustments) {
      if (adj.startCol < absStart) {
        // This adjustment is before our field, shift our position
        cumulativeAdjustment += adj.delta;
      } else if (adj.startCol >= absStart && adj.startCol <= absEnd) {
        // This adjustment is within our field (we're a parent or this is the pivot field)
        // Expand our end position
        absEnd += adj.delta;
        relEnd += adj.delta;
      }
    }

    newFieldHeaderRangeMap[key] = {
      abs: [absStart + cumulativeAdjustment, absEnd + cumulativeAdjustment],
      rel: [relStart, relEnd],
      depth: range.depth,
    };
  }

  // Calculate new total header size
  const newTotalHeaderSize =
    Math.max(...Object.values(newFieldHeaderRangeMap).map(f => f.abs[1])) + 1;

  // Create new layout with adjusted values
  const newLayout: TableLayout = {
    fields: {},
    fieldHeaderRangeMap: newFieldHeaderRangeMap,
    fieldLayout(f: Field) {
      const key = f.key;
      return this.fields[key];
    },
    totalHeaderSize: newTotalHeaderSize,
    maxDepth: layout.maxDepth,
  };

  // Update layout entries with new column ranges
  for (const key in newFieldHeaderRangeMap) {
    const oldEntry = layout.fields[key];
    if (oldEntry) {
      newLayout.fields[key] = {
        ...oldEntry,
        absoluteColumnRange: newFieldHeaderRangeMap[key].abs,
        relativeColumnRange: newFieldHeaderRangeMap[key].rel,
      };
    }
  }

  return newLayout;
}
