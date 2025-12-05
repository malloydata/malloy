/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {For, Show, createMemo, createSignal, type JSX} from 'solid-js';
import type {RecordCell, Cell} from '../../data_tree';
import type {PivotConfig, PivotedColumnField} from './pivot-utils';
import {generatePivotedCellsMap} from './pivot-utils';
import {applyRenderer} from '../renderer/apply-renderer';
import {useConfig} from '../render';

/**
 * Renders a single pivot cell value.
 */
const PivotCell = (props: {
  cell: Cell;
  columnField: PivotedColumnField;
  isFirst: boolean;
  isLast: boolean;
  rowPath: number[];
}) => {
  const config = useConfig();

  const {renderValue} = applyRenderer({
    dataColumn: props.cell,
    tag: props.columnField.field.tag,
    customProps: {},
  });

  const style = (): JSX.CSSProperties => ({});

  const isNumeric = props.columnField.field.isNumber();

  const handleClick = (evt: MouseEvent) => {
    if (config.onClick) {
      config.onClick({
        field: props.columnField.field,
        displayValue:
          typeof renderValue !== 'function' ? renderValue : null,
        value: props.cell.value,
        fieldPath: props.columnField.field.path,
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
        'numeric': isNumeric,
        'hide-start-gutter': props.isFirst,
        'hide-end-gutter': props.isLast,
      }}
      style={style()}
      onClick={config.onClick ? handleClick : undefined}
    >
      <div
        class="cell-content"
        classList={{
          'hide-start-gutter': props.isFirst,
          'hide-end-gutter': props.isLast,
        }}
        title={typeof props.cell.value === 'string' ? props.cell.value : ''}
      >
        {renderValue}
      </div>
    </div>
  );
};

/**
 * Renders an empty cell for missing pivot values.
 */
const PivotEmptyCell = (props: {
  columnField: PivotedColumnField;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const isNumeric = props.columnField.field.isNumber();

  return (
    <div
      class="column-cell td pivot-empty-cell"
      classList={{
        'numeric': isNumeric,
        'hide-start-gutter': props.isFirst,
        'hide-end-gutter': props.isLast,
      }}
    >
      <div
        class="cell-content"
        classList={{
          'hide-start-gutter': props.isFirst,
          'hide-end-gutter': props.isLast,
        }}
      >
        -
      </div>
    </div>
  );
};

/**
 * Renders an error message when pivot fails.
 */
const PivotError = (props: {message: string; columnCount: number}) => {
  return (
    <div
      class="pivot-cells-container pivot-error"
      style={{
        'grid-column': `span ${props.columnCount}`,
        'color': 'var(--malloy-render--error-color, #d32f2f)',
        'font-style': 'italic',
        'padding': '4px 8px',
      }}
    >
      {props.message}
    </div>
  );
};

/**
 * Renders all pivot cells for one row's nested pivot field.
 */
export const PivotFieldCells = (props: {
  row: RecordCell;
  pivotConfig: PivotConfig;
  rowPath: number[];
  startColumn: number;
}) => {
  const [error, setError] = createSignal<string | null>(null);

  // Get the nested cell data for this row
  const nestedCell = createMemo(() => {
    const cell = props.row.column(props.pivotConfig.field.name);
    if (cell.isRecordOrRepeatedRecord()) {
      return cell;
    }
    return null;
  });

  // Generate the map of pivot keys to cell values
  const pivotedCellsMap = createMemo(() => {
    const nc = nestedCell();
    if (!nc) {
      return new Map<string, Map<string, Cell>>();
    }
    try {
      setError(null);
      return generatePivotedCellsMap(nc, props.pivotConfig);
    } catch (e) {
      const errorMsg =
        e instanceof Error ? e.message : 'Failed to render pivot';
      setError(errorMsg);
      return new Map<string, Map<string, Cell>>();
    }
  });

  return (
    <Show
      when={!error()}
      fallback={
        <PivotError
          message={error()!}
          columnCount={props.pivotConfig.columnFields.length}
        />
      }
    >
      <div
        class="pivot-cells-container"
        style={{
          'grid-column': `${props.startColumn + 1} / span ${props.pivotConfig.columnFields.length}`,
          'display': 'grid',
          'grid-template-columns': 'subgrid',
        }}
      >
        <For each={props.pivotConfig.columnFields}>
          {(columnField, idx) => {
            const isFirst = idx() === 0;
            const isLast = idx() === props.pivotConfig.columnFields.length - 1;
            const pivotKey = columnField.pivotedField.key;
            const fieldName = columnField.field.name;

            const cell = () => {
              const map = pivotedCellsMap();
              return map.get(pivotKey)?.get(fieldName);
            };

            return (
              <>
                {cell() ? (
                  <PivotCell
                    cell={cell()!}
                    columnField={columnField}
                    isFirst={isFirst}
                    isLast={isLast}
                    rowPath={props.rowPath}
                  />
                ) : (
                  <PivotEmptyCell
                    columnField={columnField}
                    isFirst={isFirst}
                    isLast={isLast}
                  />
                )}
              </>
            );
          }}
        </For>
      </div>
    </Show>
  );
};

export default PivotFieldCells;
