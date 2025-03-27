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
import {STATE_CODES} from './state_codes';
import {formatTitle, getColorScale} from './utils';
import type {ShapeMapRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import {RendererFactory} from './renderer_factory';
import type {Cell, Field, RecordOrRepeatedRecordField} from '../data_tree';

export class HTMLShapeMapRenderer extends HTMLChartRenderer {
  private getRegionField(explore: RecordOrRepeatedRecordField): Field {
    return explore.fields[0];
  }

  private getColorField(explore: RecordOrRepeatedRecordField): Field {
    return explore.fields[1];
  }

  getDataValue(data: Cell): Date | string | number | null | undefined {
    if (data.isNumber()) {
      return data.value;
    } else if (data.isString()) {
      const regionField = this.getRegionField(data.getParentRecord(1).field);
      if (data.field === regionField) {
        const id = STATE_CODES[data.value];
        if (id === undefined) {
          return undefined;
        }
        return id;
      } else {
        return data.value;
      }
    } else if (data.isNull()) {
      // ignore nulls
      return undefined;
    } else {
      throw new Error('Invalid field type for shape map.');
    }
  }

  getDataType(
    field: Field
  ): 'temporal' | 'ordinal' | 'quantitative' | 'nominal' {
    if (field.isAtomic()) {
      if (field.isTime()) {
        return 'nominal';
      } else if (field.isString()) {
        const regionField = this.getRegionField(field.getParentRecord(1));
        if (field === regionField) {
          return 'quantitative';
        } else {
          return 'nominal';
        }
      } else if (field.isNumber()) {
        return 'quantitative';
      }
    }
    throw new Error('Invalid field type for shape map.');
  }

  getVegaLiteSpec(data: Cell): lite.TopLevelSpec {
    if (data.isNull()) {
      throw new Error('Expected struct value not to be null.');
    }

    if (!data.isRecordOrRepeatedRecord()) {
      throw new Error('Invalid data for shape map');
    }

    const regionField = this.getRegionField(data.field);
    const colorField = this.getColorField(data.field);

    const colorType = colorField ? this.getDataType(colorField) : undefined;

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

    const mapped = this.mapData(data.rows).filter(
      row => row[regionField.name] !== undefined
    );

    return {
      ...this.getSize(),
      data: {values: mapped},
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
          transform: [
            {
              lookup: regionField.name,
              from: {
                data: {
                  values: usAtlas,
                  format: {
                    type: 'topojson',
                    feature: 'states',
                  },
                },
                key: 'id',
              },
              as: 'geo',
            },
          ],
          mark: 'geoshape',
          encoding: {
            shape: {field: 'geo', type: 'geojson'},
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

export class ShapeMapRendererFactory extends RendererFactory<ShapeMapRenderOptions> {
  public static readonly instance = new ShapeMapRendererFactory();

  create(
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    _field: Field,
    options: ShapeMapRenderOptions,
    timezone?: string
  ): Renderer {
    return new HTMLShapeMapRenderer(
      document,
      styleDefaults,
      rendererOptions,
      options,
      timezone
    );
  }

  get rendererName() {
    return 'shape_map';
  }
}
