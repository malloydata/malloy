/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {For, createMemo, type Component, type JSX} from 'solid-js';
import type {
  RecordOrRepeatedRecordCell,
  Field,
  RecordCell,
} from '../../data_tree';
import {applyRenderer} from '../renderer/apply-renderer';
import {useConfig} from '../render';
import {MalloyViz} from '@/api/malloy-viz';
import styles from './table.css?raw';

const DEFAULT_TRANSPOSE_COLUMN_LIMIT = 20;

/**
 * TransposeTable renders a table with rows and columns swapped.
 * Each field becomes a row, and each data record becomes a column.
 */
const TransposeTable: Component<{
  data: RecordOrRepeatedRecordCell;
  rowLimit?: number;
}> = props => {
  MalloyViz.addStylesheet(styles);

  const config = useConfig();

  const transposeLimit =
    props.data.field.tag.numeric('transpose', 'limit') ??
    DEFAULT_TRANSPOSE_COLUMN_LIMIT;

  const visibleFields = createMemo(() =>
    props.data.field.fields.filter(f => !f.isHidden())
  );

  const rows = createMemo(() => {
    const allRows: RecordCell[] = [];
    let i = 0;
    const limit = props.rowLimit ?? Infinity;
    for (const row of props.data.rows) {
      if (i >= limit) break;
      allRows.push(row);
      i++;
    }
    return allRows;
  });

  // Enforce transpose column limit
  if (rows().length > transposeLimit) {
    return (
      <div class="transpose-error">
        Transpose column limit of {transposeLimit} exceeded ({rows().length}{' '}
        columns). Use <code># transpose.limit=N</code> to increase.
      </div>
    );
  }

  const getContainerStyle = (): JSX.CSSProperties => ({
    'display': 'grid',
    // First column for field names, then one column per data row
    'grid-template-columns': `auto ${rows()
      .map(() => 'minmax(auto, max-content)')
      .join(' ')}`,
  });

  return (
    <div class="malloy-table transpose-table" style={getContainerStyle()}>
      {/* Header row: empty cell + data values as column headers */}
      <div class="column-cell th transpose-corner-cell">
        <div class="cell-content header"></div>
      </div>
      <For each={rows()}>
        {(row, colIdx) => {
          // Find the first dimension field to use as column header
          const headerField = visibleFields().find(
            f => f.isBasic() && f.wasDimension()
          );
          const headerValue = headerField
            ? row.column(headerField.name).value
            : `Row ${colIdx() + 1}`;

          return (
            <div class="column-cell th transpose-column-header">
              <div class="cell-content header">{String(headerValue)}</div>
            </div>
          );
        }}
      </For>

      {/* Data rows: field name + values across columns */}
      <For each={visibleFields()}>
        {(field, _rowIdx) => (
          <>
            {/* Row header: field name */}
            <div
              class="column-cell th transpose-row-header"
              classList={{
                numeric: field.isNumber(),
              }}
            >
              <div class="cell-content header">
                {field.tag.text('label') ?? field.name.replace(/_/g, '_\u200b')}
              </div>
            </div>

            {/* Data cells for this field across all rows */}
            <For each={rows()}>
              {(row, _colIdx) => {
                const cell = row.column(field.name);
                const {renderValue} = applyRenderer({
                  dataColumn: cell,
                  tag: field.tag,
                  customProps: {},
                });

                const handleClick = (evt: MouseEvent) => {
                  if (config.onClick) {
                    config.onClick({
                      field,
                      displayValue:
                        typeof renderValue !== 'function' ? renderValue : null,
                      value: cell.value,
                      fieldPath: field.path,
                      isHeader: false,
                      event: evt,
                      type: 'table-cell',
                    });
                  }
                };

                return (
                  <div
                    class="column-cell td"
                    classList={{
                      numeric: field.isNumber(),
                    }}
                    onClick={config.onClick ? handleClick : undefined}
                  >
                    <div
                      class="cell-content"
                      title={typeof cell.value === 'string' ? cell.value : ''}
                    >
                      {renderValue}
                    </div>
                  </div>
                );
              }}
            </For>
          </>
        )}
      </For>
    </div>
  );
};

export default TransposeTable;

/**
 * Checks if a field should be rendered as a transposed table.
 * Syntax: # transpose
 */
export function shouldTranspose(field: Field): boolean {
  return field.tag.has('transpose');
}
