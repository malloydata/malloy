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

import {LitElement, html, TemplateResult, css, PropertyValues} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {View, parse} from 'vega';
import {compile} from 'vega-lite';
import {VegaJSON, asVegaLiteSpec, asVegaSpec} from './vega-types';

@customElement('malloy-vega-chart')
export class VegaChart extends LitElement {
  static override styles = css`
    #vis > svg {
      display: block;
    }
  `;
  @property({attribute: false})
  spec!: VegaJSON;

  @property({type: String})
  type: 'vega' | 'vega-lite' = 'vega';

  @property({type: Number})
  width?: number;

  @property({type: Number})
  height?: number;

  private el: HTMLElement | null = null;
  private view: View | null = null;

  setupView() {
    if (this.view) this.view.finalize();
    const vegaspec =
      this.type === 'vega-lite'
        ? compile(asVegaLiteSpec(this.spec)).spec
        : asVegaSpec(this.spec);

    this.view = new View(parse(vegaspec))
      .initialize(this.el!)
      .renderer('svg')
      .hover();
    if (this.width) this.view.width(this.width);
    if (this.height) this.view.height(this.height);
    console.log('view', this.view);
    this.view.run();
  }

  firstUpdated() {
    this.el = this.shadowRoot!.getElementById('vis')!;
    this.setupView();
  }

  protected willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('spec') || changedProperties.has('type')) {
      if (this.el) this.setupView();
    } else {
      if (
        (changedProperties.has('width') || changedProperties.has('height')) &&
        this.view
      ) {
        if (this.width) this.view.width(this.width);
        if (this.height) this.view.height(this.height);
        this.view.run();
      }
    }
  }

  render(): TemplateResult {
    return html` <div id="vis"></div> `;
  }
}
