import {DataArray} from '@malloydata/malloy';
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('malloy-table')
export class Table extends LitElement {
  // Define scoped styles right with your component, in plain CSS
  static styles = css`
    :host {
      --table-font-size: 12px;
      --table-row-height: 36px;
      --table-column-width-unit: 94px;
      --table-header-color: #5d626b;
      --table-header-weight: bold;
      --table-body-color: #727883;
      --table-body-weight: 400;
      --table-border: 1px solid #e5e7eb;
      --table-background: white;

      font-family: Inter, system-ui, sans-serif;
      font-size: var(--table-font-size);
    }

    table {
      border-collapse: collapse;
      background: var(--table-background);
    }

    th {
      font-weight: var(--table-header-weight);
      color: var(--table-header-color);
      height: var(--table-row-height);
      width: var(--table-column-width-unit);
      border-block: var(--table-border);
      overflow: hidden;
      white-space: nowrap;
      text-align: left;
      padding: 0px 15px;
    }

    td {
      font-weight: var(--table-body-weight);
      color: var(--table-body-color);
      height: var(--table-row-height);
      width: var(--table-column-width-unit);
      border-block: var(--table-border);
      overflow: hidden;
      overflow: hidden;
      white-space: nowrap;
      text-align: left;
      padding: 0px 15px;
    }
    th:first-child,
    td:first-child {
      padding-left: 0px;
    }
    th:last-child,
    td:last-child {
      padding-right: 0px;
    }
  `;

  constructor() {
    super();
  }

  // Declare reactive properties
  @property({attribute: false})
  table!: DataArray;

  // Render the UI as a function of component state
  render() {
    const fields = this.table.field.allFields;

    const rows = Array.from(
      this.table,
      row =>
        html`<tr>
          ${fields.map(f => html`<td>${row.cell(f).value}</td>`)}
        </tr>`
    );
    return html`<table>
      <thead>
        ${fields.map(f => html`<th>${f.name}</th>`)}
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
