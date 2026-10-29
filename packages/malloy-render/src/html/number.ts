/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {HTMLTextRenderer} from './text';
import type {NumberRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import {RendererFactory} from './renderer_factory';
import {format} from 'ssf';
import {formatBigNumber} from '../util';
import type {Cell, Field} from '../data_tree';

export class HTMLNumberRenderer extends HTMLTextRenderer {
  constructor(
    document: Document,
    readonly options: NumberRenderOptions
  ) {
    super(document);
  }

  override getText(data: Cell): string | null {
    if (!data.isNumber()) {
      return null;
    }

    if (this.options.value_format) {
      if (this.options.value_format === 'big') {
        return formatBigNumber(data.value);
      }
      try {
        return format(this.options.value_format, data.value);
      } catch {
        // TODO: explore surfacing invalid format error, ignoring it for now.
        throw new Error(`Invalid value format: ${this.options.value_format}`);
      }
    }

    return data.value.toLocaleString();
  }
}

export class NumberRendererFactory extends RendererFactory<NumberRenderOptions> {
  public static readonly instance = new NumberRendererFactory();

  constructor() {
    super();
    this.addExtractor(
      (options, tagObj) => {
        options.value_format = tagObj?.text();
      },
      this.rendererName,
      'format'
    );
  }

  activates(field: Field): boolean {
    return field.isNumber();
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field,
    options: NumberRenderOptions
  ): Renderer {
    return new HTMLNumberRenderer(document, options);
  }

  get rendererName() {
    return 'number';
  }
}
