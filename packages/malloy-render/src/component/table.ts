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

function getLocationInParent(f: Field) {
  const parent = f.parentExplore;
  return parent.allFields.findIndex(pf => pf.name === f.name);
}

@customElement('malloy-table')
export class Table extends LitElement {
  static styles = css`
    table {
      border-collapse: collapse;
      // background: var(--table-background);
      // background: #fdb7b8;
    }

    table * {
      box-sizing: border-box;
    }

    .column-cell {
      height: var(--table-row-height);
      border-top: var(--table-border);
      // border-inline: 1px solid red;
      overflow: hidden;
      white-space: nowrap;
      text-align: left;
      padding: 0px 15px;
      font-variant-numeric: tabular-nums;
      vertical-align: top;
      // width: 200px;
      // max-width: 200px;
      // min-width: 200px;
      // border-inline: 1px solid red;
      // box-shadow: red 1px 0px 0px 0px inset;
      position: relative;
    }

    // .column-cell::after {
    //   position: absolute;
    //   height: 12px;
    //   width: 12px;
    //   background: red;
    //   content: ' ';
    //   right: 0px;
    //   top: 12px;
    //   display: none;
    // }

    // .column-cell:hover::after {
    //   display: block;
    // }

    .column-cell-table {
      padding: 0px;
      // padding-left: 15px;
      // padding-right: 0px;
      height: 100%;
    }

    .column-cell.last-col {
      // border: 1px solid red;
      // border-bottom: none;
      // border-top: none;
    }

    // .column-cell.last-col .cell-wrapper {
    //   border-top: 1px solid black;
    //   display: inline-block;
    // }

    // .column-cell.last-col::after {
    //   width: 15px;
    //   height: 15px;
    //   background: red;
    //   content: 'x';
    //   display: inline-block;
    // }

    .cell-wrapper {
      height: var(--table-row-height);
      display: flex;
      align-items: center;
      overflow: hidden;
      // background: #eee;
      // height: 100%;
      // border-inline: 1px solid red;
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

    th.column-cell:first-child,
    td.column-cell:first-child {
      padding-left: 0px;
    }
    th.column-cell:last-child,
    td.column-cell:last-child {
      padding-right: 0px;
    }
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
        ? 'width: 100px; min-width: 100px; max-width: 100px;'
        : '';

    const getTestStyle = (f: Field, i: number) => {
      // return '';
      // const field = f;
      // const prevField = fields[(i - 1)];
      // console.log({field, prevField});
      const locationInParent = getLocationInParent(f);
      if (f.isExploreField() && locationInParent === 0)
        return 'padding-left: 0px';
      if (fields[i - 1]?.isExploreField()) {
        return 'padding-left: 30px;';
      }

      if (locationInParent === 0) return '';
      // return
      // return '';
      return 'padding-left: 15px;';
    };

    const getTestHeaderStyle = (f: Field, i: number) => {
      const prevField = fields[i - 1];
      if (f.isExploreField() && getPath(f).length < 40) {
        const locationInParent = getLocationInParent(f);
        if (locationInParent === 0) return 'padding-left: 0px';
        console.log({
          f,
          path: getPath(f),
          locationInParent: getLocationInParent(f),
        });
        if (prevField && prevField.isExploreField())
          return 'padding-left: 30px';
        return 'padding-left: 15px';
      } else return '';
    };

    /**
     * if table, strike out right padding so its rows end with parent above
     */

    const headers = fields.map(
      (f, i) =>
        html`<th class="column-cell" style="${getTestHeaderStyle(f, i)}">
          <div class="cell-wrapper" style="${atomicStyle(f)}">${f.name}</div>
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
