/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Renderer} from './renderer';
import type {JSONRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import {RendererFactory} from './renderer_factory';
import type {Cell, Field} from '../data_tree';

function mapToJSON(cell: Cell): unknown {
  if (cell.isArray()) {
    return cell.values.map(c => mapToJSON(c));
  } else if (cell.isNumber()) {
    return cell.value;
  } else if (cell.isBoolean() || cell.isString() || cell.isNull()) {
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
