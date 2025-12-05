/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {For} from 'solid-js';
import type {PivotConfig, PivotedField} from './pivot-utils';

/**
 * Renders the dimension values row with colspan spanning measure columns.
 * Example: "MEN" spans 2 columns if there are 2 measures.
 */
const PivotDimensionHeaderRow = (props: {
  pivotConfig: PivotConfig;
  startColumn: number;
}) => {
  const buildDimensionLabel = (pf: PivotedField): string => {
    const parts: string[] = [];
    for (const dimValue of pf.values) {
      if (dimValue && !dimValue.isNull()) {
        parts.push(String(dimValue.value));
      }
    }
    return parts.join(', ') || '';
  };

  const measureCount = props.pivotConfig.nonDimensions.length;

  return (
    <div
      class="table-row pivot-header-row pivot-dimension-row"
      style={{
        'grid-column': `${props.startColumn + 1} / span ${props.pivotConfig.columnFields.length}`,
        'display': 'grid',
        'grid-template-columns': 'subgrid',
      }}
    >
      <For each={props.pivotConfig.pivotedFields}>
        {(pf, pfIdx) => {
          const isFirst = pfIdx() === 0;
          const isLast = pfIdx() === props.pivotConfig.pivotedFields.length - 1;
          const label = buildDimensionLabel(pf);

          return (
            <div
              class="column-cell th pivot-dimension-header"
              classList={{
                'hide-start-gutter': isFirst,
                'hide-end-gutter': isLast,
              }}
              style={{
                'grid-column': `span ${measureCount}`,
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
 * Renders the measure names row (repeated for each dimension group).
 * Example: "avg_retail | total_cost | avg_retail | total_cost"
 */
const PivotMeasureHeaderRow = (props: {
  pivotConfig: PivotConfig;
  startColumn: number;
}) => {
  return (
    <div
      class="table-row pivot-header-row pivot-measure-row"
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
 * Row 1: Dimension values with colspan (e.g., "MEN" spanning 2 columns)
 * Row 2: Measure names repeated (e.g., "avg_retail | total_cost")
 */
export const PivotHeaders = (props: {
  pivotConfig: PivotConfig;
  startColumn: number;
}) => {
  return (
    <>
      <PivotDimensionHeaderRow
        pivotConfig={props.pivotConfig}
        startColumn={props.startColumn}
      />
      <PivotMeasureHeaderRow
        pivotConfig={props.pivotConfig}
        startColumn={props.startColumn}
      />
    </>
  );
};

export default PivotHeaders;
