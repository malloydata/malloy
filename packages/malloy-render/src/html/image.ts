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

import {DataColumn, Explore, Field} from '@malloydata/malloy';
import {Renderer} from '../renderer';
import {createErrorElement, createNullElement} from './utils';
import {RendererFactory} from '../renderer_factory';
import {ImageRenderOptions, StyleDefaults} from '../data_styles';
import {RendererOptions} from '../renderer_types';

export class HTMLImageRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  async render(data: DataColumn): Promise<HTMLElement> {
    if (!data.isString()) {
      return createErrorElement(
        this.document,
        'Invalid field for Image renderer'
      );
    }

    if (data.isNull()) {
      return createNullElement(this.document);
    }
    const { tag } = data.field.tagParse();
    const height = tag.numeric("image", "height");
    const width = tag.numeric("image", "width");
    const element = this.document.createElement('img');
    if(height) element.style.height = `${height}px`;
    if(width) element.style.width = `${width}px`;
    element.src = data.value;
    return element;
  }
}

export class ImageRendererFactory extends RendererFactory<ImageRenderOptions> {
  public static readonly instance = new ImageRendererFactory();

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field | Explore,
    _options: ImageRenderOptions
  ): Renderer {
    return new HTMLImageRenderer(document);
  }

  get rendererName() {
    return 'image';
  }
}
