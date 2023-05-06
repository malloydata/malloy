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

import * as lite from 'vega-lite';
import {DataArray, DataColumn, Field} from '@malloydata/malloy';
import usAtlas from 'us-atlas/states-10m.json';
import {HTMLChartRenderer} from './chart';
import {formatTitle, getColorScale} from './utils';

export class HTMLSegmentMapRenderer extends HTMLChartRenderer {
  getDataValue(data: DataColumn): string | number | null {
    if (data.isNull() || data.isNumber() || data.isString()) {
      return data.value;
    }
    throw new Error('Invalid field type for segment map.');
  }

  getDataType(field: Field): 'ordinal' | 'quantitative' | 'nominal' {
    if (field.isAtomicField()) {
      if (field.isString()) {
        return 'nominal';
      } else if (field.isNumber()) {
        return 'quantitative';
      }
      // TODO dates nominal?
    }
    throw new Error('Invalid field type for segment map.');
  }

  getVegaLiteSpec(data: DataArray): lite.TopLevelSpec {
    if (data.isNull()) {
      throw new Error('Expected struct value not to be null.');
    }

    const fields = data.field.intrinsicFields;

    const lat1Field = fields[0];
    const lon1Field = fields[1];
    const lat2Field = fields[2];
    const lon2Field = fields[3];
    const colorField = fields[4];

    const colorType = colorField ? this.getDataType(colorField) : undefined;

    const colorDef =
      colorField !== undefined
        ? {
            field: colorField.name,
            type: colorType,
            axis: {title: formatTitle(this.options, colorField.name)},
            scale: getColorScale(colorType, false),
          }
        : undefined;

    return {
      ...this.getSize(),
      data: {
        values: this.mapData(data),
      },
      projection: {
        type: 'albersUsa',
      },
      layer: [
        {
          data: {
            values: usAtlas,
            format: {
              type: 'topojson',
              feature: 'states',
            },
          },
          mark: {
            type: 'geoshape',
            fill: 'lightgray',
            stroke: 'white',
          },
        },
        {
          mark: 'line',
          encoding: {
            latitude: {field: lat1Field.name, type: 'quantitative'},
            longitude: {field: lon1Field.name, type: 'quantitative'},
            latitude2: {field: lat2Field.name, type: 'quantitative'},
            longitude2: {field: lon2Field.name, type: 'quantitative'},
            color: colorDef,
          },
        },
      ],
      background: 'transparent',
      config: {
        axis: {
          labelFont: 'var(--malloy-font-family, Roboto)',
          titleFont: 'var(--malloy-font-family, Roboto)',
          titleFontWeight: 500,
          titleColor: 'var(--malloy-title-color, #505050)',
          labelColor: 'var(--malloy-label-color, #000000)',
          titleFontSize: 12,
        },
        legend: {
          labelFont: 'var(--malloy-font-family, Roboto)',
          titleFont: 'var(--malloy-font-family, Roboto)',
          titleFontWeight: 500,
          titleColor: 'var(--malloy-title-color, #505050)',
          labelColor: 'var(--malloy-label-color, #000000)',
          titleFontSize: 12,
        },
        header: {
          labelFont: 'var(--malloy-font-family, Roboto)',
          titleFont: 'var(--malloy-font-family, Roboto)',
          titleFontWeight: 500,
        },
        mark: {font: 'var(--malloy-font-family, Roboto)'},
        title: {
          font: 'var(--malloy-font-family, Roboto)',
          subtitleFont: 'var(--malloy-font-family, Roboto)',
          fontWeight: 500,
        },
      },
    };
  }
}
