/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {HTMLTextRenderer} from './text';
import {RendererFactory} from './renderer_factory';
import type {CurrencyRenderOptions, StyleDefaults} from './data_styles';
import {Currency} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import type {Cell, Field} from '../data_tree';

export class HTMLCurrencyRenderer extends HTMLTextRenderer {
  constructor(
    document: Document,
    readonly options: CurrencyRenderOptions
  ) {
    super(document);
  }

  override getText(data: Cell): string | null {
    if (!data.isNumber()) {
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

    const numText = data.value.toLocaleString('en-US', {
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
    this.addExtractor((options, tag) => {
      options.currency = (tag?.text() as Currency) ?? Currency.Dollars;
    }, this.rendererName);
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field,
    options: CurrencyRenderOptions
  ): Renderer {
    return new HTMLCurrencyRenderer(document, options);
  }

  get rendererName() {
    return 'currency';
  }
}
