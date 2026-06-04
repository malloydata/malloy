/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Renderer} from './renderer';
import {createNullElement} from './utils';
import {RendererFactory} from './renderer_factory';
import type {DataRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Cell, Field} from '../data_tree';

export class HTMLUnsupportedRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  getText(data: Cell): string | null {
    if (data.isString() || data.isNull()) {
      return data.value;
    }
    const value = data.value;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value.toString();
    }
    return JSON.stringify(value);
  }

  async render(data: Cell): Promise<HTMLElement> {
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

  activates(field: Field): boolean {
    return field.isSQLNative();
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field,
    _options: DataRenderOptions
  ): Renderer {
    return new HTMLUnsupportedRenderer(document);
  }

  get rendererName() {
    return 'unsupported';
  }
}
