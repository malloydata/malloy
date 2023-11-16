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
      --table-gutter-size: 15px;

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
