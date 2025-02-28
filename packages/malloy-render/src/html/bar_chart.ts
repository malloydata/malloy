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
import {
  BarChartRenderOptions,
  SparkLineRenderOptions,
  StyleDefaults,
} from './data_styles';
import {RendererFactory} from './renderer_factory';
import {RendererOptions} from './renderer_types';
import {Renderer} from './renderer';
import {timeToString} from './utils';
import * as Malloy from '@malloydata/malloy-interfaces';
import {
  getCellValue,
  isAtomic,
  isDate,
  isNumber,
  isString,
  isTimestamp,
} from '../component/util';

export class HTMLBarChartRenderer extends HTMLCartesianChartRenderer {
  getMark(): 'bar' {
    return 'bar';
  }

  getDataType(
    field: Malloy.DimensionInfo
  ): 'temporal' | 'ordinal' | 'quantitative' | 'nominal' {
    if (isAtomic(field)) {
      if (isDate(field) || isTimestamp(field) || isString(field)) {
        return 'nominal';
      } else if (isNumber(field)) {
        return 'quantitative';
      }
    }
    throw new Error('Invalid field type for bar chart.');
  }

  getDataValue(
    data: Malloy.Cell,
    field: Malloy.DimensionInfo
  ): Date | string | number | null {
    if (data.kind === 'null_cell') {
      return null;
    } else if (data.kind === 'timestamp_cell') {
      const timeframe =
        field.type.kind === 'timestamp_type' ? field.type.timeframe : undefined;
      return timeToString(getCellValue(data) as Date, timeframe, this.timezone);
    } else if (data.kind === 'date_cell') {
      const timeframe =
        field.type.kind === 'date_type' ? field.type.timeframe : undefined;
      return timeToString(getCellValue(data) as Date, timeframe, this.timezone);
    } else if (data.kind === 'number_cell' || data.kind === 'string_cell') {
      return getCellValue(data) as number | string;
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
