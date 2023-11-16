import {DataArray, DataRecord, Field} from '@malloydata/malloy';
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {isFirstChild, isLastChild} from './util';

// TODO: replace with an estimator per column
function getColumnWidth() {
  return 130;
}

const getContentStyle = (f: Field) => {
  if (f.isAtomicField()) {
    const width = getColumnWidth();
    return `width: ${width}px; min-width: ${width}px; max-width: ${width}px;`;
  }
  return '';
};

const renderCell = (f: Field, value: unknown) => {
  return html`<div class="cell-wrapper">
    <div class="cell-gutter-start"></div>
    <div class="cell-content" style="${getContentStyle(f)}">${value}</div>
    <div class="cell-gutter-end"></div>
  </div>`;
};

const renderFieldContent = (row: DataRecord, f: Field) => {
  if (f.isExploreField()) {
    return html`<malloy-table
      .data=${row.cell(f) as DataArray}
    ></malloy-table>`;
  }
  return renderCell(f, row.cell(f).value);
};

const renderField = (row: DataRecord, f: Field) => {
  return html`<td
    class=${classMap({
      'column-cell': true,
      'hide-end-gutter': isLastChild(f),
      'hide-start-gutter': isFirstChild(f),
    })}
  >
    ${renderFieldContent(row, f)}
  </td>`;
};

const renderHeader = (f: Field) => {
  const isFirst = isFirstChild(f);
  const isParentFirst = isFirstChild(f.parentExplore);
  const isParentNotAField = !f.parentExplore.isExploreField();
  const hideStartGutter = isFirst && (isParentFirst || isParentNotAField);

  const isLast = isLastChild(f);
  const isParentLast = isLastChild(f.parentExplore);
  const hideEndGutter = isLast && (isParentLast || isParentNotAField);

  return html`<th
    class=${classMap({
      'column-cell': true,
      'hide-end-gutter': hideEndGutter,
      'hide-start-gutter': hideStartGutter,
    })}
  >
    ${renderCell(f, f.name)}
  </th>`;
};

@customElement('malloy-table')
export class Table extends LitElement {
  static styles = css`
    table {
      border-collapse: collapse;
      background: var(--table-background);
      font-variant-numeric: tabular-nums;
    }

    table * {
      box-sizing: border-box;
    }

    .column-cell {
      height: var(--table-row-height);
      overflow: hidden;
      white-space: nowrap;
      text-align: left;
      padding: 0px;
      vertical-align: top;
      position: relative;
    }

    td.column-cell {
      font-weight: var(--table-body-weight);
      color: var(--table-body-color);
    }

    th.column-cell {
      font-weight: var(--table-header-weight);
      color: var(--table-header-color);
    }

    .cell-wrapper {
      height: var(--table-row-height);
      display: flex;
      align-items: center;
      overflow: hidden;
    }

    .cell-content {
      border-top: var(--table-border);
      height: var(--table-row-height);
      line-height: var(--table-row-height);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cell-gutter-start {
      border-top: var(--table-border);
      height: var(--table-row-height);
      width: var(--table-gutter-size);
    }

    .cell-gutter-end {
      border-top: var(--table-border);
      height: var(--table-row-height);
      width: var(--table-gutter-size);
    }

    .hide-end-gutter .cell-gutter-end {
      border-top: none;
    }

    .hide-start-gutter .cell-gutter-start {
      border-top: none;
    }
  `;

  @property({attribute: false})
  data!: DataArray;

  render() {
    const fields = this.data.field.allFields;

    const headers = fields.map(f => renderHeader(f));

    const rows = Array.from(
      this.data,
      row =>
        html`<tr>
          ${fields.map(f => renderField(row, f))}
        </tr>`
    );

    return html`<table>
      <thead>
        <tr>
          ${headers}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'malloy-table': Table;
  }
}
