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
import {JSONRenderOptions, StyleDefaults} from './data_styles';
import {RendererOptions} from './renderer_types';
import {RendererFactory} from './renderer_factory';
import * as Malloy from '@malloydata/malloy-interfaces';

function mapToJSON(cell: Malloy.Cell, field: Malloy.DimensionInfo): unknown {
  switch (cell.kind) {
    case 'array_cell': {
      if (field.type.kind !== 'array_type') {
        throw new Error('Expected array type');
      }
      const elementType = field.type.element_type;
      return cell.array_value.map(c =>
        mapToJSON(c, {type: elementType, name: 'foo'})
      );
      break;
    }
    case 'boolean_cell':
      return cell.boolean_value;
    case 'date_cell':
      return cell.date_value.toString();
    case 'timestamp_cell':
      return cell.timestamp_value.toString();
    case 'number_cell':
      return cell.number_value;
    case 'string_cell':
      return cell.string_value;
    case 'null_cell':
      return null;
    case 'json_cell': {
      try {
        return JSON.parse(cell.json_value);
      } catch (error) {
        return cell.json_value;
      }
    }
    case 'record_cell': {
      const result = {};
      if (field.type.kind !== 'record_type') {
        throw new Error('Expected record type');
      }
      for (let i = 0; i < field.type.fields.length; i++) {
        const child = field.type.fields[i];
        result[child.name] = mapToJSON(cell.record_value[i], child);
      }
      return result;
    }
  }
}

export class HTMLJSONRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  async render(
    table: Malloy.Cell,
    field: Malloy.DimensionInfo
  ): Promise<HTMLElement> {
    const element = this.document.createElement('pre');
    element.appendChild(
      this.document.createTextNode(
        JSON.stringify(mapToJSON(table, field), undefined, 2)
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
    _field: Malloy.DimensionInfo,
    _options: JSONRenderOptions
  ): Renderer {
    return new HTMLJSONRenderer(document);
  }

  get rendererName() {
    return 'json';
  }
}
