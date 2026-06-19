/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {HTMLCartesianChartRenderer} from './cartesian_chart';
import type {
  LineChartRenderOptions,
  ScatterChartRenderOptions,
  StyleDefaults,
} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import {RendererFactory} from './renderer_factory';
import type {Cell, Field} from '../data_tree';

export class HTMLScatterChartRenderer extends HTMLCartesianChartRenderer {
  getMark(): 'point' {
    return 'point';
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
    throw new Error('Invalid field type for scatter chart.');
  }

  getDataValue(data: Cell): Date | string | number | null {
    if (data.isNull()) {
      return null;
    } else if (data.isTime() || data.isString()) {
      return data.value;
    } else if (data.isNumber()) {
      return data.value;
    } else {
      throw new Error('Invalid field type for scatter chart.');
    }
  }
}

export class ScatterChartRendererFactory extends RendererFactory<ScatterChartRenderOptions> {
  public static readonly instance = new ScatterChartRendererFactory();

  create(
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    _field: Field,
    options: LineChartRenderOptions,
    timezone?: string
  ): Renderer {
    return new HTMLScatterChartRenderer(
      document,
      styleDefaults,
      rendererOptions,
      options,
      timezone
    );
  }

  get rendererName() {
    return 'scatter_chart';
  }
}
