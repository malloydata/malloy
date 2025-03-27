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

import {HTMLTextRenderer} from './text';
import type {NumberRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import {RendererFactory} from './renderer_factory';
import {format} from 'ssf';
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
