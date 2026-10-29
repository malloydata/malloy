/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {HTMLCartesianChartRenderer} from './cartesian_chart';
import type {LineChartRenderOptions, StyleDefaults} from './data_styles';
import {RendererFactory} from './renderer_factory';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import type {Cell, Field} from '../data_tree';

export class HTMLLineChartRenderer extends HTMLCartesianChartRenderer {
  getMark(): 'line' {
    return 'line';
  }

  getDataType(
    field: Field
  ): 'temporal' | 'ordinal' | 'quantitative' | 'nominal' {
    if (field.isTime()) {
      return 'temporal';
    } else if (field.isString()) {
      return 'nominal';
    } else if (field.isNumber()) {
      return 'quantitative';
    }
    throw new Error('Invalid field type for line chart.');
  }

  getDataValue(data: Cell): Date | string | number | null {
    if (data.isNull()) {
      return null;
    } else if (data.isTime()) {
      return data.value;
    } else if (data.isNumber()) {
      return data.value;
    } else if (data.isString()) {
      return data.value;
    } else {
      throw new Error('Invalid field type for line chart.');
    }
  }
}

export class LineChartRendererFactory extends RendererFactory<LineChartRenderOptions> {
  public static readonly instance = new LineChartRendererFactory();

  create(
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    _field: Field,
    options: LineChartRenderOptions,
    timezone?: string
  ): Renderer {
    return new HTMLLineChartRenderer(
      document,
      styleDefaults,
      rendererOptions,
      options,
      timezone
    );
  }

  get rendererName() {
    return 'line_chart';
  }
}
