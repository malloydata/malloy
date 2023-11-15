/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {DataArray} from '@malloydata/malloy';
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('malloy-table')
export class Table extends LitElement {
  static override styles = css`
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

  override render() {
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
