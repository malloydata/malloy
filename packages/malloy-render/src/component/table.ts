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

import {DataArray, DataRecord, Field} from '@malloydata/malloy';
import {LitElement, TemplateResult, css, html, nothing} from 'lit';
import {customElement, eventOptions, property, state} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {createContext, provide, consume} from '@lit/context';
import {isFirstChild, isLastChild} from './util';
import {RendererOptions} from '../renderer_types';
import {getDrillQuery} from '../drill';

type TableContext = {
  root: boolean;
};

const tableContext = createContext<TableContext | undefined>('table');

type RenderOptions = {
  pinnedHeader?: boolean;
};

// TODO: replace with an estimator per column
function getColumnWidth() {
  return 130;
}

const getContentStyle = (f: Field | null) => {
  if (f !== null && f.isAtomicField()) {
    const width = getColumnWidth();
    return `width: ${width}px; min-width: ${width}px; max-width: ${width}px;`;
  }
  return '';
};

const renderCell = (
  f: Field | null,
  value: unknown,
  options: {
    hideStartGutter: boolean;
    hideEndGutter: boolean;
  }
) => {
  return html`<div class="cell-wrapper">
    <div
      class=${classMap({
        'cell-gutter': true,
        'hide-gutter-border': options.hideStartGutter,
      })}
    ></div>
    <div class="cell-content" style="${getContentStyle(f)}">${value}</div>
    <div
      class=${classMap({
        'cell-gutter': true,
        'hide-gutter-border': options.hideEndGutter,
      })}
    ></div>
  </div>`;
};

function clicked(e: Event, row: DataRecord, options: RendererOptions) {
  if (options.onDrill) {
    const {drillQuery, drillFilters} = getDrillQuery(row);
    options.onDrill(drillQuery, e.target! as HTMLElement, drillFilters);
  }
}

const renderDrillCell = (row: DataRecord, options: RendererOptions) => {
  return html`<div class="cell-wrapper">
    <div
      class=${classMap({
        'cell-gutter': true,
        'hide-gutter-border': false,
      })}
    ></div>
    <div
      class="cell-content drill-icon"
      style=""
      @click="${e => clicked(e, row, options)}"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="12" fill="none" class="copy-circle" />
        <svg
          x="6"
          y="6"
          width="12"
          height="14"
          viewBox="0 0 12 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 10.6667C3.63333 10.6667 3.31944 10.5361 3.05833 10.275C2.79722 10.0139 2.66667 9.7 2.66667 9.33333V1.33333C2.66667 0.966667 2.79722 0.652778 3.05833 0.391667C3.31944 0.130556 3.63333 0 4 0H10C10.3667 0 10.6806 0.130556 10.9417 0.391667C11.2028 0.652778 11.3333 0.966667 11.3333 1.33333V9.33333C11.3333 9.7 11.2028 10.0139 10.9417 10.275C10.6806 10.5361 10.3667 10.6667 10 10.6667H4ZM4 9.33333H10V1.33333H4V9.33333ZM1.33333 13.3333C0.966667 13.3333 0.652778 13.2028 0.391667 12.9417C0.130556 12.6806 0 12.3667 0 12V2.66667H1.33333V12H8.66667V13.3333H1.33333Z"
            fill="#E7E7E7"
            class="copy-icon"
          />
        </svg>
      </svg>
    </div>
    <div
      class=${classMap({
        'cell-gutter': true,
        'hide-gutter-border': true,
      })}
    ></div>
  </div>`;
};

const renderFieldContent = (
  row: DataRecord,
  f: Field,
  options: RendererOptions
) => {
  if (f.isExploreField()) {
    return html`<malloy-table
      .data=${row.cell(f) as DataArray}
      .options=${options}
      .rowLimit=${options.pinnedHeader ?? false ? 1 : Infinity}
    ></malloy-table>`;
  }
  let value = row.cell(f).value;
  if (options.pinnedHeader) value = '';
  else if (f.isAtomicField() && f.isNumber())
    value = (value as number).toLocaleString();

  return renderCell(f, value, {
    hideStartGutter: isFirstChild(f),
    hideEndGutter: isLastChild(f) && (options.isDrillingEnabled ?? false),
  });
};

const renderField = (row: DataRecord, f: Field, options: RendererOptions) => {
  const isLast = isLastChild(f);
  let drillCell;

  if (isLast && (options.isDrillingEnabled ?? false)) {
    drillCell = html`<td class="column-cell">
      ${renderDrillCell(row, options)}
    </td>`;
  } else {
    drillCell = '';
  }

  return html`<td
      class="column-cell ${classMap({
        numeric: f.isAtomicField() && f.isNumber(),
      })}"
    >
      ${renderFieldContent(row, f, options)}
    </td>
    ${drillCell} `;
};

const renderHeader = (f: Field, drillingEnabled: boolean) => {
  const isFirst = isFirstChild(f);
  const isParentFirst = isFirstChild(f.parentExplore);
  const isParentNotAField = !f.parentExplore.isExploreField();
  const hideStartGutter = isFirst && (isParentFirst || isParentNotAField);

  const isLast = isLastChild(f);
  const isParentLast = isLastChild(f.parentExplore);
  const hideEndGutter = isLast && (isParentLast || isParentNotAField);

  let drillHeader;
  if (isLast && drillingEnabled) {
    drillHeader = html`<th class="column-cell">
      ${renderCell(null, '', {
        hideStartGutter,
        hideEndGutter,
      })}
    </th>`;
  } else {
    drillHeader = '';
  }

  return html`<th
      class="column-cell ${classMap({
        numeric: f.isAtomicField() && f.isNumber(),
      })}"
    >
      ${renderCell(f, f.name, {
        hideStartGutter,
        hideEndGutter: hideEndGutter && !drillingEnabled,
      })}
    </th>
    ${drillHeader}`;
};

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
      height: var(--malloy-render--table-row-height);
      display: flex;
      align-items: center;
      overflow: hidden;
    }

    .cell-content {
      border-top: var(--malloy-render--table-border);
      height: var(--malloy-render--table-row-height);
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

    .drill-icon:hover .copy-circle {
      fill: #eef7f9;
    }

    .drill-icon:active .copy-circle {
      fill: #cfe9f0;
    }

    .drill-icon:hover .copy-icon,
    .drill-icon:active .copy-icon {
      fill: #53b2c8;
    }
  `;

  @property({attribute: false})
  data!: DataArray;

  @property({attribute: false})
  options!: RendererOptions;

  @property({type: Number})
  rowLimit = Infinity;

  // @property({type: Boolean})
  // pinnedHeader = false;

  @state()
  protected _scrolling = false;

  @consume({context: tableContext})
  @property({attribute: false})
  public parentCtx: TableContext | undefined;

  @provide({context: tableContext})
  ctx = {root: false};

  override connectedCallback() {
    super.connectedCallback();
    if (typeof this.parentCtx === 'undefined') {
      this.ctx = {
        root: true,
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
    if (this.options.pinnedHeader ?? false) return this;
    return super.createRenderRoot();
  }

  override render() {
    const fields = this.data.field.allFields;
    const drillingEnabled: boolean = this.options.isDrillingEnabled ?? false;

    const headers = fields.map(f => renderHeader(f, drillingEnabled));

    // const renderOptions: RenderOptions = {
    //   pinnedHeader: this.pinnedHeader,
    // };

    const rows: TemplateResult[] = [];
    let i = 0;
    for (const row of this.data) {
      if (i >= this.rowLimit) break;
      rows.push(
        html`<tr>
          ${fields.map(f => renderField(row, f, this.options))}
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
              .options=${this.options}
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
