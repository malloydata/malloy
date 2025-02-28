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

import {Renderer} from './renderer';
import {createErrorElement, createNullElement, getDynamicValue} from './utils';
import {LinkRenderOptions, StyleDefaults} from './data_styles';
import {RendererOptions} from './renderer_types';
import {RendererFactory} from './renderer_factory';
import * as Malloy from '@malloydata/malloy-interfaces';
import {tagFor} from '../component/util';

export class HTMLLinkRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  async render(
    data: Malloy.Cell,
    field: Malloy.DimensionInfo
  ): Promise<HTMLElement> {
    if (data.kind === 'null_cell') {
      return createNullElement(this.document);
    }

    const tag = tagFor(field);
    const linkTag = tag.tag('link');

    if (!linkTag) {
      return createErrorElement(this.document, 'Missing tag for Link renderer');
    }

    if (data.kind !== 'string_cell') {
      return createErrorElement(
        this.document,
        'Invalid type for link renderer.'
      );
    }

    // Read href component from field value or override with field tag if it exists
    const hrefComponent =
      getDynamicValue<string>({tag: linkTag, data}) ?? data.string_value;

    // if a URL template is provided, replace the data were '$$$' appears.
    const urlTemplate = linkTag.text('url_template');

    const element = this.document.createElement('a');
    element.href = hrefComponent;
    if (urlTemplate) {
      if (urlTemplate.indexOf('$$') > -1) {
        element.href = urlTemplate.replace('$$', hrefComponent);
      } else {
        element.href = urlTemplate + hrefComponent;
      }
    }
    element.target = '_blank';
    element.appendChild(
      this.document.createTextNode(data.string_value.replace(/\//g, '/\u200C'))
    );
    return element;
  }
}

export class LinkRendererFactory extends RendererFactory<LinkRenderOptions> {
  public static readonly instance = new LinkRendererFactory();

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Malloy.DimensionInfo,
    _options: LinkRenderOptions
  ): Renderer {
    return new HTMLLinkRenderer(document);
  }

  get rendererName() {
    return 'link';
  }
}
