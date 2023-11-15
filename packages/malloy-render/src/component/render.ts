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

import {Result} from '@malloydata/malloy';
import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import './table';

@customElement('malloy-render')
export class MalloyRender extends LitElement {
  static styles = css`
    :host {
      --table-font-size: 12px;
      --table-row-height: 36px;
      --table-header-color: #5d626b;
      --table-header-weight: bold;
      --table-body-color: #727883;
      --table-body-weight: 400;
      --table-border: 1px solid #e5e7eb;
      --table-background: white;

      font-family: Inter, system-ui, sans-serif;
      font-size: var(--table-font-size);
    }
  `;

  @property({attribute: false})
  result!: Result;

  override render() {
    return html`<malloy-table .data=${this.result.data}></malloy-table>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'malloy-render': MalloyRender;
  }
}
