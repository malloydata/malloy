/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {For} from 'solid-js';
import type {PivotConfig, PivotedColumnField} from './pivot-utils';

/**
 * Renders combined headers: dimension values + measure names in one row.
 * Format: "DimValue: measure_name" for each column.
 */
const PivotCombinedHeaderRow = (props: {
  pivotConfig: PivotConfig;
  startColumn: number;
}) => {
  // Build combined header label from dimension values + measure name
  const buildHeaderLabel = (col: PivotedColumnField): string => {
    const dimParts: string[] = [];
    for (const dimValue of col.pivotedField.values) {
      if (dimValue && !dimValue.isNull()) {
        dimParts.push(String(dimValue.value));
      }
    }
    const customLabel = col.field.tag.text('label');
    const measureName = customLabel ?? col.field.name;

    if (dimParts.length > 0) {
      return `${dimParts.join(', ')}: ${measureName}`;
    }
    return measureName;
  };

  return (
    <div
      class="table-row pivot-header-row"
      style={{
        'grid-column': `${props.startColumn + 1} / span ${props.pivotConfig.columnFields.length}`,
        'display': 'grid',
        'grid-template-columns': 'subgrid',
      }}
    >
      <For each={props.pivotConfig.columnFields}>
        {(col, idx) => {
          const isFirst = idx() === 0;
          const isLast = idx() === props.pivotConfig.columnFields.length - 1;
          const isNumeric = col.field.isNumber();
          const label = buildHeaderLabel(col);

          return (
            <div
              class="column-cell th"
              classList={{
                'numeric': isNumeric,
                'hide-start-gutter': isFirst,
                'hide-end-gutter': isLast,
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
 * Renders all header rows for a pivot field.
 * Uses a single combined row with "DimValue: measure_name" format
 * for better readability.
 */
export const PivotHeaders = (props: {
  pivotConfig: PivotConfig;
  startColumn: number;
}) => {
  return (
    <PivotCombinedHeaderRow
      pivotConfig={props.pivotConfig}
      startColumn={props.startColumn}
    />
  );
};

export default PivotHeaders;
