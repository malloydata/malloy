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

import {
  DataColumn,
  Explore,
  Field,
  MalloyTagProperties,
} from '@malloydata/malloy';
import {HTMLTextRenderer} from './text';
import {RendererFactory} from '../renderer_factory';
import {Currency, CurrencyRenderOptions, StyleDefaults} from '../data_styles';
import {RendererOptions} from '../renderer_types';
import {Renderer} from '../renderer';

export class HTMLCurrencyRenderer extends HTMLTextRenderer {
  constructor(document: Document, readonly options: CurrencyRenderOptions) {
    super(document);
  }

  override getText(data: DataColumn): string | null {
    if (data.isNull()) {
      return null;
    }

    let unitText = '$';
    switch (this.options.currency) {
      case Currency.Euros:
        unitText = '€';
        break;
      case Currency.Pounds:
        unitText = '£';
        break;
      case Currency.Dollars:
        // Do nothing.
        break;
    }

    const numText = data.number.value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `${unitText}${numText}`;
  }
}

export class CurrencyRendererFactory extends RendererFactory<CurrencyRenderOptions> {
  public static readonly instance = new CurrencyRendererFactory();

  constructor() {
    super();
    this.addExtractor((options, value) => {
      options.currency = (value as Currency) ?? Currency.Dollars;
    }, this.rendererName);
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field | Explore,
    options: CurrencyRenderOptions
  ): Renderer {
    return new HTMLCurrencyRenderer(document, options);
  }

  get rendererName() {
    return 'currency';
  }
}
