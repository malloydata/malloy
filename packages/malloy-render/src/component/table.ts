import {DataArray, DataRecord, Explore, Field} from '@malloydata/malloy';
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {styleMap} from 'lit/directives/style-map.js';

function getPath(f: Field | Explore) {
  const path = [f.name];
  while (f.parentExplore) {
    path.unshift(f.parentExplore.name);
    f = f.parentExplore;
  }
  return path;
}

@customElement('malloy-table')
export class Table extends LitElement {
  static styles = css`
    table {
      border-collapse: collapse;
      background: var(--table-background);
    }

    table * {
      box-sizing: border-box;
    }

    .column-cell {
      height: var(--table-row-height);
      border-top: var(--table-border);
      border-inline: 1px solid red;
      overflow: hidden;
      white-space: nowrap;
      text-align: left;
      padding: 0px 15px;
      font-variant-numeric: tabular-nums;
      vertical-align: top;
      // width: 200px;
      // max-width: 200px;
      // min-width: 200px;
    }

    .column-cell-table {
      padding: 0px;
      padding-left: 15px;
    }

    .cell-wrapper {
      height: var(--table-row-height);
      display: flex;
      align-items: center;
      border-inline: 1px solid red;
    }

    th.column-cell {
      font-weight: var(--table-header-weight);
      color: var(--table-header-color);
    }

    :host(.embedded) th.column-cell {
      border-top: 0px;
    }

    td.column-cell {
      font-weight: var(--table-body-weight);
      color: var(--table-body-color);
    }

    // th.column-cell:first-child,
    // td.column-cell:first-child {
    //   padding-left: 0px;
    // }
    // th.column-cell:last-child,
    // td.column-cell:last-child {
    //   padding-right: 0px;
    // }
  `;

  @property({attribute: false})
  data!: DataArray;

  render() {
    const fields = this.data.field.allFields;
    const fieldClass = (f: Field) =>
      f.isExploreField() ? 'column-cell-table' : '';
    const renderField = (row: DataRecord, f: Field) => {
      if (f.isExploreField()) {
        return html`<malloy-table
          class="embedded"
          .data=${row.cell(f) as DataArray}
        ></malloy-table>`;
      }
      return html`<div class="cell-wrapper">${row.cell(f).value}</div>`;
    };

    if (this.data.field.name === 'n') {
      console.log(this.data.field);
    }

    const atomicStyle = (f: Field) =>
      f.isAtomicField()
        ? 'width: 200px; min-width: 200px; max-width: 200px;'
        : '';

    const getTestStyle = (f: Field, i: number) => {
      // const field = f;
      // const prevField = fields[(i - 1)];
      // console.log({field, prevField});
      if (fields[i - 1]?.isExploreField()) {
        return 'padding-left: 30px;';
      }
      return 'padding-left: 15px;';
    };

    /**
     * if table, strike out right padding so its rows end with parent above
     */

    const headers = fields.map(
      f =>
        html`<th class="column-cell">
          <div class="cell-wrapper" style=${atomicStyle(f)}>${f.name}</div>
        </th>`
    );

    const rows = Array.from(
      this.data,
      row =>
        html`<tr>
          ${fields.map(
            (f, i) =>
              html`<td
                class="column-cell ${classMap({
                  'column-cell-table': f.isExploreField(),
                })}"
                style="${atomicStyle(f)} ${getTestStyle(f, i)}"
              >
                ${renderField(row, f)}
              </td>`
          )}
        </tr>`
    );

    return html`<table>
      <thead>
        ${headers}
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
