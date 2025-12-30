/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {For} from 'solid-js';
import type {Cell, Field} from '../../data_tree';
import type {PivotConfig, PivotedField} from './pivot-utils';
import {renderNumberCell, renderDateTimeField} from '../render-numeric-field';

/**
 * Info about a sibling field (non-pivot field at same depth as pivot).
 */
export type SiblingFieldInfo = {
  field: Field;
  startColumn: number;
  endColumn: number;
};

/**
 * Renders a cell value for display in pivot dimension headers.
 * Uses proper formatting based on cell type and field tags.
 */
const renderPivotDimensionValue = (cell: Cell): string => {
  if (cell.isNull()) {
    return '';
  }

  // Number cells: use renderNumberCell which handles bigint and formatting tags
  if (cell.isNumber()) {
    return renderNumberCell(cell);
  }

  // Date cells: use renderDateTimeField with date options
  if (cell.isDate()) {
    return renderDateTimeField(cell.field, cell.value, {
      isDate: true,
      timeframe: cell.timeframe,
    });
  }

  // Timestamp cells: use renderDateTimeField with timestamp options
  if (cell.isTimestamp()) {
    return renderDateTimeField(cell.field, cell.value, {
      isDate: false,
      timeframe: cell.timeframe,
    });
  }

  // Boolean: display as true/false
  if (cell.isBoolean()) {
    return String(cell.value);
  }

  // String and other types: use value directly
  return String(cell.value);
};

/**
 * Renders the dimension values row spanning the full table width.
 * Non-pivot columns get empty space, pivot columns get dimension headers.
 */
const PivotDimensionHeaderRow = (props: {
  pivotConfig: PivotConfig;
  pivotStartColumn: number;
  totalColumns: number;
  siblingFields: SiblingFieldInfo[];
}) => {
  const buildDimensionLabel = (pf: PivotedField): string => {
    const parts: string[] = [];
    for (const dimValue of pf.values) {
      if (dimValue && !dimValue.isNull()) {
        parts.push(renderPivotDimensionValue(dimValue));
      }
    }
    return parts.join(', ') || '';
  };

  const measureCount = props.pivotConfig.nonDimensions.length;

  return (
    <div
      class="table-row pivot-header-row pivot-dimension-row"
      style={{
        'grid-column': `1 / span ${props.totalColumns}`,
        'display': 'grid',
        'grid-template-columns': 'subgrid',
      }}
    >
      {/* Empty space for sibling columns before pivot */}
      <For each={props.siblingFields}>
        {sibling => {
          const colSpan = sibling.endColumn - sibling.startColumn + 1;
          return (
            <div
              class="column-cell th pivot-sibling-spacer"
              style={{
                'grid-column': `${sibling.startColumn + 1} / span ${colSpan}`,
              }}
            >
              {/* Empty - sibling headers render in measure row */}
            </div>
          );
        }}
      </For>
      {/* Pivot dimension headers */}
      <For each={props.pivotConfig.pivotedFields}>
        {(pf, pfIdx) => {
          const isFirst = pfIdx() === 0;
          const isLast = pfIdx() === props.pivotConfig.pivotedFields.length - 1;
          const label = buildDimensionLabel(pf);
          // Calculate the actual grid column for this pivoted field
          const colOffset = pfIdx() * measureCount;

          return (
            <div
              class="column-cell th pivot-dimension-header"
              classList={{
                'hide-start-gutter': isFirst,
                'hide-end-gutter': isLast,
              }}
              style={{
                'grid-column': `${props.pivotStartColumn + 1 + colOffset} / span ${measureCount}`,
              }}
            >
              <div class="cell-content header">
                {label.replace(/_/g, '_\u200b')}
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
};

/**
 * Renders the measure names row spanning the full table width.
 * Includes both sibling field headers and pivot measure headers.
 */
const PivotMeasureHeaderRow = (props: {
  pivotConfig: PivotConfig;
  pivotStartColumn: number;
  totalColumns: number;
  siblingFields: SiblingFieldInfo[];
}) => {
  return (
    <div
      class="table-row pivot-header-row pivot-measure-row"
      style={{
        'grid-column': `1 / span ${props.totalColumns}`,
        'display': 'grid',
        'grid-template-columns': 'subgrid',
      }}
    >
      {/* Sibling field headers */}
      <For each={props.siblingFields}>
        {sibling => {
          const colSpan = sibling.endColumn - sibling.startColumn + 1;
          const isNumeric = sibling.field.isNumber();
          const customLabel = sibling.field.tag.text('label');
          const name = customLabel ?? sibling.field.name;

          return (
            <div
              class="column-cell th"
              classList={{
                numeric: isNumeric,
              }}
              style={{
                'grid-column': `${sibling.startColumn + 1} / span ${colSpan}`,
              }}
            >
              <div class="cell-content header">
                {name.replace(/_/g, '_\u200b')}
              </div>
            </div>
          );
        }}
      </For>
      {/* Pivot measure headers */}
      <For each={props.pivotConfig.columnFields}>
        {(col, idx) => {
          const isFirst = idx() === 0;
          const isLast = idx() === props.pivotConfig.columnFields.length - 1;
          const isNumeric = col.field.isNumber();
          const customLabel = col.field.tag.text('label');
          const measureName = customLabel ?? col.field.name;

          return (
            <div
              class="column-cell th"
              classList={{
                'numeric': isNumeric,
                'hide-start-gutter': isFirst,
                'hide-end-gutter': isLast,
              }}
              style={{
                'grid-column': `${props.pivotStartColumn + 1 + idx()}`,
              }}
            >
              <div class="cell-content header">
                {measureName.replace(/_/g, '_\u200b')}
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
};

/**
 * Renders all header rows for a pivot field.
 * Row 1: Empty for siblings + dimension values with colspan
 * Row 2: Sibling headers + measure names repeated
 */
export const PivotHeaders = (props: {
  pivotConfig: PivotConfig;
  pivotStartColumn: number;
  totalColumns: number;
  siblingFields: SiblingFieldInfo[];
}) => {
  return (
    <>
      <PivotDimensionHeaderRow
        pivotConfig={props.pivotConfig}
        pivotStartColumn={props.pivotStartColumn}
        totalColumns={props.totalColumns}
        siblingFields={props.siblingFields}
      />
      <PivotMeasureHeaderRow
        pivotConfig={props.pivotConfig}
        pivotStartColumn={props.pivotStartColumn}
        totalColumns={props.totalColumns}
        siblingFields={props.siblingFields}
      />
    </>
  );
};

export default PivotHeaders;
