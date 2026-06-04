/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {HTMLNumberRenderer} from './number';
import type {PercentRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import {RendererFactory} from './renderer_factory';
import type {Cell, Field} from '../data_tree';

export class HTMLPercentRenderer extends HTMLNumberRenderer {
  override getText(data: Cell): string | null {
    if (!data.isNumber()) {
      return null;
    }
    const num = data.value;

    return num === null
      ? num
      : (num * 100).toLocaleString('en', {maximumFractionDigits: 2}) + '%';
  }
}

export class PercentRendererFactory extends RendererFactory<PercentRenderOptions> {
  public static readonly instance = new PercentRendererFactory();

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field,
    options: PercentRenderOptions
  ): Renderer {
    return new HTMLPercentRenderer(document, options);
  }

  get rendererName() {
    return 'percent';
  }
}
