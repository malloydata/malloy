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

import {AtomicField, DataArray, DataRecord, Field} from '@malloydata/malloy';
import {
  LitElement,
  PropertyValues,
  TemplateResult,
  css,
  html,
  nothing,
} from 'lit';
import {customElement, eventOptions, property, state} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {createContext, provide, consume} from '@lit/context';
import {
  getFieldKey,
  isFirstChild,
  isLastChild,
  shouldRenderAs,
  valueIsNumber,
  valueIsString,
} from './util';
import {renderNumericField} from './render-numeric-field';
import {resultContext} from './result-context';
import {RenderResultMetadata} from './render-result-metadata';
import {TableLayout, getTableLayout} from './table-layout';

type TableContext = {
  root: boolean;
  layout: TableLayout;
};

const tableContext = createContext<TableContext | undefined>('table');

@customElement('malloy-table')
export class Table extends LitElement {
  static override styles = css`
    .table-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: auto;
    }

    .sticky-header {
      position: sticky;
      top: 0px;
      z-index: 100;
    }

    .sticky-header-content {
      position: absolute;
      top: 0px;
      left: 0px;
      pointer-events: none;
    }

    .sticky-header-content th {
      pointer-events: all;
    }

    table {
      border-collapse: collapse;
      background: var(--malloy-render--table-background);
    }

    th {
      transition: background-color 0.25s;
    }

    table * {
      box-sizing: border-box;
    }

    .column-cell {
      height: var(--malloy-render--table-row-height);
      overflow: hidden;
      white-space: nowrap;
      text-align: left;
      padding: 0px;
      vertical-align: top;
      position: relative;
    }

    td.column-cell {
      font-weight: var(--malloy-render--table-body-weight);
      color: var(--malloy-render--table-body-color);
    }

    th.column-cell {
      font-weight: var(--malloy-render--table-header-weight);
      color: var(--malloy-render--table-header-color);
    }

    .column-cell.numeric {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .cell-wrapper {
      // height: var(--malloy-render--table-row-height);
      display: flex;
      align-items: start;
      overflow: hidden;
    }

    .cell-content {
      border-top: var(--malloy-render--table-border);
      height: 100%;
      line-height: var(--malloy-render--table-row-height);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cell-gutter {
      border-top: var(--malloy-render--table-border);
      height: var(--malloy-render--table-row-height);
      width: var(--malloy-render--table-gutter-size);
      transition: border-color 0.25s;
    }

    .cell-gutter.hide-gutter-border {
      border-color: transparent;
    }

    .pinned-header table {
      background: transparent;
    }

    .pinned-header th {
      background: var(--malloy-render--table-background);
    }

    .pinned-header.scrolled th {
      background: var(--malloy-render--table-pinned-background);
      box-shadow: 0 0 0.5em rgba(0, 0, 0, 0.5);
    }

    .pinned-header.scrolled {
      .cell-content,
      .cell-gutter,
      .cell-gutter.hide-gutter-border {
        border-top: var(--malloy-render--table-pinned-border);
      }
    }
  `;

  @property({attribute: false})
  data!: DataArray;

  @property({type: Number})
  rowLimit = Infinity;

  @property({type: Boolean})
  pinnedHeader = false;

  @state()
  protected _scrolling = false;

  @consume({context: tableContext})
  @property({attribute: false})
  public parentCtx: TableContext | undefined;

  @provide({context: tableContext})
  ctx!: TableContext;

  @consume({context: resultContext})
  @property({attribute: false})
  metadata!: RenderResultMetadata;

  override connectedCallback() {
    super.connectedCallback();
    if (typeof this.parentCtx === 'undefined') {
      this.ctx = {
        root: true,
        layout: {},
      };
    } else {
      this.ctx = {
        root: false,
        layout: this.parentCtx.layout,
      };
    }
  }

  @eventOptions({passive: true})
  private _handleScroll(e: Event) {
    const target = e.target as HTMLElement;
    this._scrolling = target.scrollTop > 0;
  }

  // If rendering a pinned header, render it within the current ShadowDOM root so we can use CSS to style the nested table headers when scrolling
  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    if (this.pinnedHeader) return this;
    return super.createRenderRoot();
  }

  private renderHeader(f: Field) {
    const isFirst = isFirstChild(f);
    const isParentFirst = isFirstChild(f.parentExplore);
    const isParentNotAField = !f.parentExplore.isExploreField();
    const hideStartGutter = isFirst && (isParentFirst || isParentNotAField);

    const isLast = isLastChild(f);
    const isParentLast = isLastChild(f.parentExplore);
    const hideEndGutter = isLast && (isParentLast || isParentNotAField);

    return html`<th
      class="column-cell ${classMap({
        numeric: f.isAtomicField() && f.isNumber(),
      })}"
    >
      ${this.renderCell(f, f.name, {
        hideStartGutter,
        hideEndGutter,
        isHeader: true,
      })}
    </th>`;
  }

  private renderField(row: DataRecord, f: Field) {
    return html`<td
      class="column-cell ${classMap({
        numeric: f.isAtomicField() && f.isNumber(),
      })}"
    >
      ${this.renderFieldContent(row, f)}
    </td>`;
  }

  private getColumnWidth(f: Field) {
    const key = getFieldKey(f);
    return this.ctx.layout[key].width;
  }

  private getContentStyle(f: Field, isHeader = false) {
    const width = this.getColumnWidth(f);
    let style = '';
    if (isHeader) return style;

    if (typeof width !== 'undefined') {
      style += `width: ${width}px; min-width: ${width}px; max-width: ${width}px;`;
    }

    const height = this.ctx.layout[getFieldKey(f)].height;
    if (typeof height === 'number') {
      style += `height: ${height}px;`;
    }

    return style;
  }

  private renderCell(
    f: Field,
    value: string | number | TemplateResult,
    options: {
      hideStartGutter: boolean;
      hideEndGutter: boolean;
      isHeader: boolean;
    }
  ) {
    return html`<div class="cell-wrapper">
      <div
        class=${classMap({
          'cell-gutter': true,
          'hide-gutter-border': options.hideStartGutter,
        })}
      ></div>
      <div
        class="cell-content"
        style="${this.getContentStyle(f, options.isHeader)}"
        title="${value}"
      >
        ${value}
      </div>
      <div
        class=${classMap({
          'cell-gutter': true,
          'hide-gutter-border': options.hideEndGutter,
        })}
      ></div>
    </div>`;
  }

  private renderFieldContent(row: DataRecord, f: Field) {
    const renderAs = shouldRenderAs(f);
    // Render nested tables without gutters
    if (renderAs === 'table') {
      return html`<malloy-table
        .data=${row.cell(f) as DataArray}
        .pinnedHeader=${this.pinnedHeader ?? false}
        .rowLimit=${this.pinnedHeader ? 1 : Infinity}
      ></malloy-table>`;
    }
    const resultCellValue = row.cell(f).value;
    let renderValue: string | number | TemplateResult = '';
    if (this.pinnedHeader) renderValue = '';
    else if (renderAs === 'bar-chart') {
      renderValue = html`<malloy-bar-chart
        .data=${row.cell(f) as DataArray}
      ></malloy-bar-chart>`;
    } else if (valueIsNumber(f, resultCellValue)) {
      // TS doesn't support typeguards for multiple parameters, so unfortunately have to assert AtomicField here. https://github.com/microsoft/TypeScript/issues/26916
      renderValue = renderNumericField(f as AtomicField, resultCellValue);
    } else if (resultCellValue === null) {
      renderValue = '∅';
    } else if (valueIsString(f, resultCellValue)) {
      renderValue = resultCellValue;
    }

    return this.renderCell(f, renderValue, {
      hideStartGutter: isFirstChild(f),
      hideEndGutter: isLastChild(f),
      isHeader: false,
    });
  }

  willUpdate(changedProperties: PropertyValues<this>) {
    if (this.ctx.root && changedProperties.has('data')) {
      this.ctx.layout = getTableLayout(this.metadata);
    }
  }

  override render() {
    const fields = this.data.field.allFields;
    const headers = fields.map(f => this.renderHeader(f));

    const rows: TemplateResult[] = [];
    let i = 0;
    for (const row of this.data) {
      if (i >= this.rowLimit) break;
      rows.push(
        html`<tr>
          ${fields.map(f => this.renderField(row, f))}
        </tr>`
      );
      i++;
    }

    const renderStickyHeader = () => {
      if (this.ctx.root) {
        return html`<div class="sticky-header">
          <div class="sticky-header-content">
            <malloy-table
              class=${classMap({
                'pinned-header': true,
                'scrolled': this._scrolling,
              })}
              .rowLimit=${1}
              .data=${this.data}
              .pinnedHeader=${true}
            ></malloy-table>
          </div>
        </div>`;
      }

      return nothing;
    };

    return html`<div
      @scroll=${this._handleScroll}
      class="table-wrapper"
      part=${this.ctx.root ? 'table-container' : nothing}
    >
      ${renderStickyHeader()}
      <table>
        <thead>
          <tr>
            ${headers}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'malloy-table': Table;
  }
}
