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
import type {
  DataRenderOptions,
  StyleDefaults,
  TextRenderOptions,
} from './data_styles';
import {RendererFactory} from './renderer_factory';
import type {RendererOptions} from './renderer_types';
import type {Cell, Field} from '../data_tree';

export class HTMLTextRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  getText(data: Cell): string | null {
    return data.isNull() ? null : `${data.value}`;
  }

  async render(data: Cell): Promise<HTMLElement> {
    let text: string | null = null;
    try {
      text = this.getText(data);
    } catch (e) {
      return createErrorElement(this.document, e);
    }

    if (text === null) {
      return createNullElement(this.document);
    }

    const element = this.document.createElement('span');
    element.appendChild(this.document.createTextNode(text));
    return element;
  }
}

export class TextRendererFactory extends RendererFactory<TextRenderOptions> {
  public static readonly instance = new TextRendererFactory();

  activates(field: Field): boolean {
    return !field.isRoot() && field.isString();
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field,
    _options: DataRenderOptions
  ): Renderer {
    return new HTMLTextRenderer(document);
  }

  get rendererName() {
    return undefined;
  }
}
