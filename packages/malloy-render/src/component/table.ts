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

function getLocationInParent(f: Field | Explore) {
  const parent = f.parentExplore;
  return parent?.allFields.findIndex(pf => pf.name === f.name) ?? -1;
}

function getNextParentSibling(f: Field) {
  const parent = f.parentExplore;
  const loc = getLocationInParent(parent);
  if (loc) return parent.parentExplore?.allFields[loc + 1];
  return undefined;
}

function getPreviousParentSibling(f: Field) {
  const parent = f.parentExplore;
  const loc = getLocationInParent(parent);
  if (loc) return parent.parentExplore?.allFields[loc - 1];
  return undefined;
}

function getColumnWidth() {
  return 130;
}

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

    /* TODO: remove */

    .column-cell::after {
      position: absolute;
      height: 12px;
      width: 12px;
      background: red;
      content: ' ';
      right: 0px;
      top: 12px;
      display: none;
    }

    /* TODO: remove */
    .column-cell:hover::after {
      display: block;
    }

    /* TODO: remove */
    .column-cell::before {
      position: absolute;
      height: 12px;
      width: 12px;
      background: green;
      content: ' ';
      left: 0px;
      top: 12px;
      display: none;
    }

    /* TODO: remove */
    .column-cell:hover::before {
      display: block;
    }

    .cell-wrapper {
      height: var(--table-row-height);
      display: flex;
      align-items: center;
      overflow: hidden;
    }

    .inner-cell-wrapper {
      border-top: var(--table-border);
      height: var(--table-row-height);
      line-height: var(--table-row-height);
    }

    .cell-gutter {
      border-top: var(--table-border);
    }

    .cell-gutter-start {
      border-top: var(--table-border);
    }

    .hide-end-gutter .cell-gutter {
      border-top: none;
    }

    .hide-start-gutter .cell-gutter-start {
      border-top: none;
    }

    td.column-cell {
      font-weight: var(--table-body-weight);
      color: var(--table-body-color);
    }

    th.column-cell {
      font-weight: var(--table-header-weight);
      color: var(--table-header-color);
    }
  `;

  @property({attribute: false})
  data!: DataArray;

  render() {
    const fields = this.data.field.allFields;
    const renderField = (row: DataRecord, f: Field) => {
      if (f.isExploreField()) {
        return html`<malloy-table
          class="embedded"
          .data=${row.cell(f) as DataArray}
        ></malloy-table>`;
      }
      // style="flex: 1; overflow: hidden; text-overflow: ellipsis;"
      return html`<div class="cell-wrapper">
        <div class="cell-gutter-start" style="width: 15px; height: 36px;"></div>

        <div
          class="inner-cell-wrapper"
          style="flex: 1; overflow: hidden; text-overflow: ellipsis;"
        >
          ${row.cell(f).value}
        </div>

        <div class="cell-gutter" style="width: 15px; height: 36px;"></div>
      </div> `;
    };

    const atomicStyle = (f: Field) =>
      f.isAtomicField()
        ? 'width: 130px; min-width: 130px; max-width: 130px;'
        : '';

    const getTestStyle = (f: Field, i: number) => {
      return 'padding-left: 0px';
    };

    const getTestHeaderStyle = (f: Field, i: number) => {
      return 'padding-left: 0px;';
    };

    const headers = fields.map(
      (f, i) =>
        html`<th
          class="column-cell ${classMap({
            'last-col':
              getLocationInParent(f) === f.parentExplore.allFields.length - 1,
            'start-col': getLocationInParent(f) === 0,

            'hide-end-gutter':
              getLocationInParent(f) === f.parentExplore.allFields.length - 1 &&
              (f.parentExplore.parentExplore?.allFields
                ? getLocationInParent(f.parentExplore) ===
                  f.parentExplore.parentExplore?.allFields.length - 1
                : false),

            'hide-start-gutter':
              getLocationInParent(f) === 0 &&
              // f.parentExplore.parentExplore?.structSource.type === "query_result"
              (f.parentExplore.parentExplore?.allFields
                ? getLocationInParent(f.parentExplore) === 0 ||
                  !f.parentExplore.isExploreField()
                : true),
          })}"
          style="${getTestHeaderStyle(f, i)}"
        >
          <div class="cell-wrapper" style="${atomicStyle(f)}">
            <div
              class="cell-gutter-start"
              style="width: 15px; height: 36px;"
            ></div>

            <div
              class="inner-cell-wrapper"
              style="flex: 1; overflow: hidden; text-overflow: ellipsis;"
            >
              ${f.name}
            </div>

            <div class="cell-gutter" style="width: 15px; height: 36px;"></div>
          </div>
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
                  'last-col':
                    getLocationInParent(f) ===
                    f.parentExplore.allFields.length - 1,
                  'start-col': getLocationInParent(f) === 0,
                  'hide-end-gutter':
                    getLocationInParent(f) ===
                    f.parentExplore.allFields.length - 1,
                  'hide-start-gutter': getLocationInParent(f) === 0,
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
