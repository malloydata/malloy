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
import {createNullElement} from './utils';
import {RendererFactory} from '../renderer_factory';
import {DataRenderOptions, StyleDefaults} from '../data_styles';
import {RendererOptions} from '../renderer_types';

export class HTMLUnsupportedRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  getText(data: DataColumn): string | null {
    const value = data.value;
    if (typeof value === 'string') {
      return value;
    } else if (value === null) {
      return null;
    } else {
      const record = data.value as Record<string, unknown>;
      if ('value' in record && typeof record['value'] === 'string') {
        return record['value'];
      }
    }
    return JSON.stringify(data.value);
  }

  async render(data: DataColumn): Promise<HTMLElement> {
    const text = this.getText(data);
    if (text === null) {
      return createNullElement(this.document);
    }

    const element = this.document.createElement('span');
    element.appendChild(this.document.createTextNode(text));
    return element;
  }
}

export class UnsupportedRendererFactory extends RendererFactory<DataRenderOptions> {
  public static readonly instance = new UnsupportedRendererFactory();

  activates(field: Field | Explore): boolean {
    return (
      field.hasParentExplore() && field.isAtomicField() && field.isUnsupported()
    );
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field | Explore,
    _options: DataRenderOptions
  ): Renderer {
    return new HTMLUnsupportedRenderer(document);
  }

  get rendererName() {
    return undefined;
  }
}
