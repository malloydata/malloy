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
import {getThemeValue} from './theme';

@customElement('malloy-render')
export class MalloyRender extends LitElement {
  static override styles = css`
    :host {
      --malloy-theme--table-row-height: 28px;
      --malloy-theme--table-font-size: 12px;
      --malloy-theme--table-header-color: #5d626b;
      --malloy-theme--table-header-weight: bold;
      --malloy-theme--table-body-color: #727883;
      --malloy-theme--table-body-weight: 400;
      --malloy-theme--table-border: 1px solid #e5e7eb;
      --malloy-theme--table-background: white;
      --malloy-theme--table-gutter-size: 15px;
      --malloy-theme--table-pinned-background: #f5fafc;
      --malloy-theme--table-pinned-border: 1px solid #daedf3;

      font-family: Inter, system-ui, sans-serif;
      font-size: var(--malloy-render--table-font-size);
    }

    @supports (font-variation-settings: normal) {
      :host {
        font-family:
          InterVariable,
          Inter,
          system-ui sans-serif;

        font-feature-settings:
          'liga' 1,
          'calt' 1;
      }
    }
  `;

  @property({attribute: false})
  result!: Result;

  override render() {
    const modelTag = this.result.resultExplore.modelTag;
    const {tag: resultTag} = this.result.tagParse();

    const modelTheme = modelTag.tag('theme');
    const localTheme = resultTag.tag('theme');
    const tableRowHeight = getThemeValue(
      'tableRowHeight',
      localTheme,
      modelTheme
    );
    const tableBodyColor = getThemeValue(
      'tableBodyColor',
      localTheme,
      modelTheme
    );
    const tableFontSize = getThemeValue(
      'tableFontSize',
      localTheme,
      modelTheme
    );
    const tableHeaderColor = getThemeValue(
      'tableHeaderColor',
      localTheme,
      modelTheme
    );
    const tableHeaderWeight = getThemeValue(
      'tableHeaderWeight',
      localTheme,
      modelTheme
    );
    const tableBodyWeight = getThemeValue(
      'tableBodyWeight',
      localTheme,
      modelTheme
    );
    const tableBorder = getThemeValue('tableBorder', localTheme, modelTheme);
    const tableBackground = getThemeValue(
      'tableBackground',
      localTheme,
      modelTheme
    );
    const tableGutterSize = getThemeValue(
      'tableGutterSize',
      localTheme,
      modelTheme
    );
    const tablePinnedBackground = getThemeValue(
      'tablePinnedBackground',
      localTheme,
      modelTheme
    );
    const tablePinnedBorder = getThemeValue(
      'tablePinnedBorder',
      localTheme,
      modelTheme
    );

    const dynamicStyle = html`<style>
      :host {
        --malloy-render--table-row-height: ${tableRowHeight};
        --malloy-render--table-body-color: ${tableBodyColor};
        --malloy-render--table-font-size: ${tableFontSize};
        --malloy-render--table-header-color: ${tableHeaderColor};
        --malloy-render--table-header-weight: ${tableHeaderWeight};
        --malloy-render--table-body-weight: ${tableBodyWeight};
        --malloy-render--table-border: ${tableBorder};
        --malloy-render--table-background: ${tableBackground};
        --malloy-render--table-gutter-size: ${tableGutterSize};
        --malloy-render--table-pinned-background: ${tablePinnedBackground};
        --malloy-render--table-pinned-border: ${tablePinnedBorder};
      }
    </style>`;

    return html`${dynamicStyle}<malloy-table
        exportparts="table-container: container"
        .data=${this.result.data}
      ></malloy-table>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'malloy-render': MalloyRender;
  }
}
