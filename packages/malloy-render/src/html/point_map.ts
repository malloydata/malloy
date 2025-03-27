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

import type * as lite from 'vega-lite';
import usAtlas from 'us-atlas/states-10m.json';
import {HTMLChartRenderer} from './chart';
import {formatTitle, getColorScale, timeToString} from './utils';
import {RendererFactory} from './renderer_factory';
import type {PointMapRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import type {Cell, CellBase, Field} from '../data_tree';

export class HTMLPointMapRenderer extends HTMLChartRenderer {
  getDataValue(data: Cell): string | number {
    if (data.isNumber() || data.isString()) {
      return data.value;
    } else if (data.isTime()) {
      return timeToString(
        data.value,
        data.field.timeframe ?? (data.isDate() ? 'day' : 'second'),
        this.timezone
      );
    }
    throw new Error('Invalid field type for point map chart.');
  }

  getDataType(field: Field): 'ordinal' | 'quantitative' | 'nominal' {
    if (field.isTime() || field.isString()) {
      return 'nominal';
    } else if (field.isNumber()) {
      return 'quantitative';
    }
    throw new Error('Invalid field type for point map.');
  }

  getVegaLiteSpec(data: CellBase): lite.TopLevelSpec {
    if (data.isNull()) {
      throw new Error('Expected struct value not to be null.');
    }
    if (!data.isRecordOrRepeatedRecord()) {
      throw new Error('Expected field to be a nest field.');
    }

    const fields = data.field.fields;

    const latField = fields[0];
    const lonField = fields[1];
    const colorField = fields[2];
    const sizeField = fields[3];
    const shapeField = fields[4];

    const colorType = colorField ? this.getDataType(colorField) : undefined;
    const sizeType = sizeField ? this.getDataType(sizeField) : undefined;
    const shapeType = shapeField ? this.getDataType(shapeField) : undefined;

    const colorDef =
      colorField !== undefined
        ? {
            field: colorField.name,
            type: colorType,
            axis: {
              title: formatTitle(
                this.options,
                colorField,
                undefined,
                this.timezone
              ),
            },
            scale: getColorScale(colorType, false),
          }
        : undefined;

    const sizeDef = sizeField
      ? {
          field: sizeField.name,
          type: sizeType,
          axis: {
            title: formatTitle(
              this.options,
              sizeField,
              undefined,
              this.timezone
            ),
          },
        }
      : {value: 5};

    const shapeDef = shapeField
      ? {
          field: shapeField.name,
          type: shapeType,
          axis: {
            title: formatTitle(
              this.options,
              shapeField,
              undefined,
              this.timezone
            ),
          },
        }
      : {value: 'circle'};

    return {
      ...this.getSize(),
      data: {
        values: this.mapData(data.rows),
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
            fill: '#efefef',
            stroke: 'white',
          },
        },
        {
          mark: 'point',
          encoding: {
            latitude: {field: latField.name, type: 'quantitative'},
            longitude: {field: lonField.name, type: 'quantitative'},
            size: sizeDef,
            color: colorDef,
            shape: shapeDef,
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
        mark: {font: 'var(--malloy-Roboto'},
        title: {
          font: 'var(--malloy-font-family, Roboto)',
          subtitleFont: 'var(--malloy-font-family, Roboto)',
          fontWeight: 500,
        },
      },
    };
  }
}

export class PointMapRendererFactory extends RendererFactory<PointMapRenderOptions> {
  public static readonly instance = new PointMapRendererFactory();

  create(
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    _field: Field,
    options: PointMapRenderOptions,
    timezone?: string
  ): Renderer {
    return new HTMLPointMapRenderer(
      document,
      styleDefaults,
      rendererOptions,
      options,
      timezone
    );
  }

  get rendererName() {
    return 'point_map';
  }
}
