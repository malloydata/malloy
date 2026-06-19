/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
