import {DataArray} from '@malloydata/malloy';
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('malloy-table')
export class Table extends LitElement {
  static styles = css`
    table {
      border-collapse: collapse;
      background: var(--table-background);
    }

    .column-cell {
      height: var(--table-row-height);
      border-block: var(--table-border);
      overflow: hidden;
      white-space: nowrap;
      text-align: left;
      padding: 0px 15px;
      font-variant-numeric: tabular-nums;
    }

    th.column-cell {
      font-weight: var(--table-header-weight);
      color: var(--table-header-color);
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

    const headers = fields.map(
      f => html`<th class="column-cell">${f.name}</th>`
    );

    const rows = Array.from(
      this.data,
      row =>
        html`<tr>
          ${fields.map(
            f => html`<td class="column-cell">${row.cell(f).value}</td>`
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
