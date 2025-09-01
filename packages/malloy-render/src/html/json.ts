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
import type {JSONRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import {RendererFactory} from './renderer_factory';
import type {Cell, Field} from '../data_tree';

function mapToJSON(cell: Cell): unknown {
  if (cell.isArray()) {
    return cell.values.map(c => mapToJSON(c));
  } else if (
    cell.isBoolean() ||
    cell.isNumber() ||
    cell.isString() ||
    cell.isNull()
  ) {
    return cell.value;
  } else if (cell.isTime()) {
    return cell.value.toISOString();
  } else if (cell.isJSON()) {
    {
      try {
        return JSON.parse(cell.value);
      } catch (error) {
        return cell.value;
      }
    }
  } else if (cell.isRecord()) {
    const result = {};
    for (const child of cell.columns) {
      result[child.field.name] = mapToJSON(child);
    }
    return result;
  }
  return null;
}

export class HTMLJSONRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  async render(table: Cell): Promise<HTMLElement> {
    const element = this.document.createElement('pre');
    element.appendChild(
      this.document.createTextNode(
        JSON.stringify(mapToJSON(table), undefined, 2)
      )
    );
    return element;
  }
}

export class JSONRendererFactory extends RendererFactory<JSONRenderOptions> {
  public static readonly instance = new JSONRendererFactory();

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field,
    _options: JSONRenderOptions
  ): Renderer {
    return new HTMLJSONRenderer(document);
  }

  get rendererName() {
    return 'json';
  }
}
