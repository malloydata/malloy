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

import type {Renderer} from './renderer';
import {createErrorElement, createNullElement} from './utils';
import {RendererFactory} from './renderer_factory';
import type {ImageRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Cell, Field} from '../data_tree';

export class HTMLImageRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  async render(data: Cell): Promise<HTMLElement> {
    if (!data.isNull() && !data.isString()) {
      return createErrorElement(
        this.document,
        'Invalid field for Image renderer'
      );
    }

    const tag = data.field.tag;
    const imgTag = tag.tag('image');

    if (!imgTag) {
      return createErrorElement(
        this.document,
        'Missing tag for Image renderer'
      );
    }

    const element: HTMLElement = data.isNull()
      ? createNullElement(this.document)
      : this.document.createElement('img');

    const width = imgTag.text('width');
    const height = imgTag.text('height');
    // Both image and null placeholder get matching size
    if (width) element.style.width = width;
    if (height) element.style.height = height;

    const img = element as HTMLImageElement;

    const altTag = imgTag.tag('alt');
    if (altTag) {
      const ref = altTag.text('field');
      let alt: string | undefined;
      if (ref) {
        alt = String(data.getRelativeCell(ref)?.value);
      } else {
        alt = altTag.text();
      }
      if (alt) img.alt = alt;
    }

    // Image specific props
    if (!data.isNull()) {
      img.src = data.value;
    }
    return element;
  }
}

export class ImageRendererFactory extends RendererFactory<ImageRenderOptions> {
  public static readonly instance = new ImageRendererFactory();

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field,
    _options: ImageRenderOptions
  ): Renderer {
    return new HTMLImageRenderer(document);
  }

  get rendererName() {
    return 'image';
  }
}
