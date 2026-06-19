/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {HTMLTextRenderer} from './text';
import {RendererFactory} from './renderer_factory';
import type {BooleanRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import type {Cell, Field} from '../data_tree';

export class HTMLBooleanRenderer extends HTMLTextRenderer {
  override getText(data: Cell): string | null {
    if (!data.isBoolean()) {
      return null;
    }

    return `${data.value}`;
  }
}

export class BooleanRendererFactory extends RendererFactory<BooleanRenderOptions> {
  public static readonly instance = new BooleanRendererFactory();

  activates(field: Field): boolean {
    return field.isBoolean();
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field,
    _options: BooleanRenderOptions
  ): Renderer {
    return new HTMLBooleanRenderer(document);
  }

  get rendererName() {
    return 'boolean';
  }
}
