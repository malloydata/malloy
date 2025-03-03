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
import usAtlas from 'us-atlas/states-10m.json';
import {HTMLChartRenderer} from './chart';
import {STATE_CODES} from './state_codes';
import {formatTitle, getColorScale} from './utils';
import {ShapeMapRenderOptions, StyleDefaults} from './data_styles';
import {RendererOptions} from './renderer_types';
import {Renderer} from './renderer';
import {RendererFactory} from './renderer_factory';
import * as Malloy from '@malloydata/malloy-interfaces';
import {
  getCell,
  getNestFields,
  isAtomic,
  isDate,
  isNest,
  isNumber,
  isString,
  isTimestamp,
  NestFieldInfo,
} from '../component/util';
import { Field } from '../component/render-result-metadata';

type MappedRow = {[p: string]: string | number | Date | undefined | null};

export class HTMLShapeMapRenderer extends HTMLChartRenderer {
  private getRegionField(explore: Malloy.DimensionInfo): Malloy.DimensionInfo {
    if (!isNest(explore)) {
      throw new Error('Expected this to be an array of records.');
    }
    return getNestFields(explore)[0];
  }

  private getColorField(explore: Malloy.DimensionInfo): Malloy.DimensionInfo {
    if (!isNest(explore)) {
      throw new Error('Expected this to be an array of records.');
    }
    return getNestFields(explore)[1];
  }

  mapData2(
    data: Malloy.Cell[],
    field: NestFieldInfo,
    regionField: Malloy.DimensionInfo
  ): MappedRow[] {
    const mappedRows: MappedRow[] = [];
    for (const rowCell of data) {
      if (rowCell.kind !== 'record_cell') {
        throw new Error('Expected record cell');
      }
      const row = rowCell.record_value;
      const mappedRow: {
        [p: string]: string | number | Date | undefined | null;
      } = {};
      for (const f of getNestFields(field)) {
        mappedRow[f.name] = this.getDataValue2(
          getCell(field, row, f.name),
          f,
          regionField
        );
      }
      mappedRows.push(mappedRow);
    }
    return mappedRows;
  }

  getDataValue(
    data: Malloy.Cell,
    field: Malloy.DimensionInfo
  ): Date | string | number | null | undefined {
    return this.getDataValue2(data, field, undefined);
  }

  getDataValue2(
    data: Malloy.Cell,
    field: Malloy.DimensionInfo,
    regionField?: Malloy.DimensionInfo
  ): string | number | undefined {
    if (data.kind === 'number_cell') {
      return data.number_value;
    } else if (data.kind === 'string_cell') {
      if (field === regionField) {
        const id = STATE_CODES[data.string_value];
        if (id === undefined) {
          return undefined;
        }
        return id;
      } else {
        return data.string_value;
      }
    } else if (data.kind === 'null_cell') {
      // ignore nulls
      return undefined;
    } else {
      throw new Error('Invalid field type for shape map.');
    }
  }

  getDataType(
    field: Malloy.DimensionInfo
  ): 'temporal' | 'ordinal' | 'quantitative' | 'nominal' {
    return this.getDataType2(field, undefined);
  }

  getDataType2(
    field: Malloy.DimensionInfo,
    regionField?: Malloy.DimensionInfo
  ): 'ordinal' | 'quantitative' | 'nominal' {
    if (isAtomic(field)) {
      if (isDate(field) || isTimestamp(field)) {
        return 'nominal';
      } else if (isString(field)) {
        if (field === regionField) {
          return 'quantitative';
        } else {
          return 'nominal';
        }
      } else if (isNumber(field)) {
        return 'quantitative';
      }
    }
    throw new Error('Invalid field type for shape map.');
  }

  getVegaLiteSpec(
    data: Malloy.Cell,
    field: Malloy.DimensionInfo
  ): lite.TopLevelSpec {
    if (data.kind === 'null_cell') {
      throw new Error('Expected struct value not to be null.');
    }

    if (data.kind !== 'array_cell' || !isNest(field)) {
      throw new Error('Invalid data for shape map');
    }

    const regionField = this.getRegionField(field);
    const colorField = this.getColorField(field);

    const colorType = colorField
      ? this.getDataType2(colorField, regionField)
      : undefined;

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

    const mapped = this.mapData2(data.array_value, field, regionField).filter(
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
