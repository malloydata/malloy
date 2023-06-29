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

import {DataColumn, Explore, Field} from '@malloydata/malloy';
import {HTMLCartesianChartRenderer} from './cartesian_chart';
import {
  BarChartRenderOptions,
  SparkLineRenderOptions,
  StyleDefaults,
} from '../data_styles';
import {RendererFactory} from '../renderer_factory';
import {RendererOptions} from '../renderer_types';
import {Renderer} from '../renderer';
import {timeToString} from './utils';
import {
  BarChartRenderOptions,
  SparkLineRenderOptions,
  StyleDefaults,
} from '../data_styles';
import {RendererFactory} from '../renderer_factory';
import {RendererOptions} from '../renderer_types';
import {Renderer} from '../renderer';

export class HTMLBarChartRenderer extends HTMLCartesianChartRenderer {
  getMark(): 'bar' {
    return 'bar';
  }

  getDataType(
    field: Field
  ): 'temporal' | 'ordinal' | 'quantitative' | 'nominal' {
    if (field.isAtomicField()) {
      if (field.isDate() || field.isTimestamp() || field.isString()) {
        return 'nominal';
      } else if (field.isNumber()) {
        return 'quantitative';
      }
    }
    throw new Error('Invalid field type for bar chart.');
  }

  getDataValue(data: DataColumn): Date | string | number | null {
    if (data.isNull()) {
      return null;
    } else if (data.isTimestamp() || data.isDate()) {
      return timeToString(data.value, data.field.timeframe, this.timezone);
    } else if (data.isNumber() || data.isString()) {
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
    _field: Field | Explore,
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
