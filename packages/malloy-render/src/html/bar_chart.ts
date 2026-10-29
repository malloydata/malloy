/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {HTMLCartesianChartRenderer} from './cartesian_chart';
import type {
  BarChartRenderOptions,
  SparkLineRenderOptions,
  StyleDefaults,
} from './data_styles';
import {RendererFactory} from './renderer_factory';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import {timeToString} from './utils';
import type {Cell, Field} from '../data_tree';

export class HTMLBarChartRenderer extends HTMLCartesianChartRenderer {
  getMark(): 'bar' {
    return 'bar';
  }

  getDataType(
    field: Field
  ): 'temporal' | 'ordinal' | 'quantitative' | 'nominal' {
    if (field.isTime() || field.isString()) {
      return 'nominal';
    } else if (field.isNumber()) {
      return 'quantitative';
    }
    throw new Error('Invalid field type for bar chart.');
  }

  getDataValue(data: Cell): Date | string | number | null {
    if (data.isNull()) {
      return null;
    } else if (data.isTime()) {
      const timeframe = data.field.timeframe;
      return timeToString(data.value, timeframe, this.timezone);
    } else if (data.isNumber()) {
      return data.value;
    } else if (data.isString()) {
      return data.value;
    } else {
      throw new Error('Invalid field type for bar chart.');
    }
  }
}

export class BarChartRendererFactory extends RendererFactory<BarChartRenderOptions> {
  public static readonly instance = new BarChartRendererFactory();
  create(
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    _field: Field,
    options: SparkLineRenderOptions,
    timezone?: string
  ): Renderer {
    return new HTMLBarChartRenderer(
      document,
      styleDefaults,
      rendererOptions,
      options,
      timezone
    );
  }

  get rendererName() {
    return 'bar_chart';
  }
}
