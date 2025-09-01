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
    if (data.isNull() || data.isTime() || data.isString() || data.isNumber()) {
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
