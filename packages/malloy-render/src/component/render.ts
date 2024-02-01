/* eslint-disable @typescript-eslint/ban-ts-comment */
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

import {ModelDef, QueryResult, Result, Tag} from '@malloydata/malloy';
import {LitElement, html, css, PropertyValues} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import './table';
import './bar-chart';
import {provide} from '@lit/context';
import {resultContext} from './result-context';
import {
  RenderResultMetadata,
  getResultMetadata,
} from './render-result-metadata';
import {parsePlotTags} from './plot/parse-plot-tags';
import {plotToVega} from './plot/plot-to-vega';

// Get the first valid theme value or fallback to CSS variable
function getThemeValue(prop: string, ...themes: Array<Tag | undefined>) {
  let value: string | undefined;
  for (const theme of themes) {
    value = theme?.text(prop);
    if (typeof value !== 'undefined') break;
  }
  // If no theme overrides, convert prop name from camelCase to kebab and pull from --malloy-theme-- variable
  return (
    value ??
    `var(--malloy-theme--${prop
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()})`
  );
}

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
      --malloy-theme--font-family: Inter, system-ui, sans-serif;

      font-family: var(--malloy-render--font-family);
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
  result?: Result;

  @property({attribute: false})
  queryResult?: QueryResult;

  @property({attribute: false})
  modelDef?: ModelDef;

  @state()
  private _result!: Result;

  @provide({context: resultContext})
  metadata!: RenderResultMetadata;

  willUpdate(changedProperties: PropertyValues<this>) {
    if (
      changedProperties.has('result') ||
      changedProperties.has('queryResult') ||
      changedProperties.has('modelDef')
    ) {
      if (this.result) this._result = this.result;
      else if (this.queryResult && this.modelDef) {
        this._result = new Result(this.queryResult, this.modelDef);
      }
      this.metadata = getResultMetadata(this._result);
      const modelTag = this._result.modelTag;
      const {tag: resultTag} = this._result.tagParse();
      const modelTheme = modelTag.tag('theme');
      const localTheme = resultTag.tag('theme');
      this.updateTheme(modelTheme, localTheme);
    }
  }

  updateTheme(modelTheme?: Tag, localTheme?: Tag) {
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
    const fontFamily = getThemeValue('fontFamily', localTheme, modelTheme);

    this.style.setProperty('--malloy-render--table-row-height', tableRowHeight);
    this.style.setProperty('--malloy-render--table-body-color', tableBodyColor);
    this.style.setProperty('--malloy-render--table-font-size', tableFontSize);
    this.style.setProperty('--malloy-render--font-family', fontFamily);
    this.style.setProperty(
      '--malloy-render--table-header-color',
      tableHeaderColor
    );
    this.style.setProperty(
      '--malloy-render--table-header-weight',
      tableHeaderWeight
    );
    this.style.setProperty(
      '--malloy-render--table-body-weight',
      tableBodyWeight
    );
    this.style.setProperty('--malloy-render--table-border', tableBorder);
    this.style.setProperty(
      '--malloy-render--table-background',
      tableBackground
    );
    this.style.setProperty(
      '--malloy-render--table-gutter-size',
      tableGutterSize
    );
    this.style.setProperty(
      '--malloy-render--table-pinned-background',
      tablePinnedBackground
    );
    this.style.setProperty(
      '--malloy-render--table-pinned-border',
      tablePinnedBorder
    );
  }

  override render() {
    // console.log(this._result, {
    //   tags: this._result.tagParse(),
    // });
    const {tag} = this._result.tagParse();
    if (tag.has('plot')) {
      const spec = parsePlotTags(this._result);
      const vgSpec = plotToVega(spec);

      // @ts-ignore
      const data = this._result.data.queryData;
      vgSpec.data[0].values = data;
      console.log('SPEC', spec);
      console.log('VGSPEC', vgSpec);
      return html`<malloy-vega-chart .spec=${vgSpec}></malloy-vega-chart>`;
    }

    return html`<malloy-table
      exportparts="table-container: container"
      .data=${this._result.data}
      .width=${400}
      .height=${200}
    ></malloy-table>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'malloy-render': MalloyRender;
  }
}
