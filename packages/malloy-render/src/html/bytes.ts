/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {HTMLTextRenderer} from './text';
import type {BytesRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import {RendererFactory} from './renderer_factory';
import type {Cell, Field} from '../data_tree';

export class HTMLBytesRenderer extends HTMLTextRenderer {
  override getText(_data: Cell): string | null {
    return null; // TODO not supported any more
  }
}

export class BytesRendererFactory extends RendererFactory<BytesRenderOptions> {
  public static readonly instance = new BytesRendererFactory();

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field,
    _options: BytesRenderOptions
  ): Renderer {
    return new HTMLBytesRenderer(document);
  }

  get rendererName() {
    return 'bytes';
  }
}
