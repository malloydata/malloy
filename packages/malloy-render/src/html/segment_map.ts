/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as lite from 'vega-lite';
import usAtlas from 'us-atlas/states-10m.json';
import {HTMLChartRenderer} from './chart';
import {formatTitle, getColorScale} from './utils';
import {RendererFactory} from './renderer_factory';
import type {SegmentMapRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import type {Cell, Field} from '../data_tree';

export class HTMLSegmentMapRenderer extends HTMLChartRenderer {
  getDataValue(data: Cell): string | number | null {
    if (data.isNull()) {
      return null;
    } else if (data.isNumber()) {
      return data.value;
    } else if (data.isString()) {
      return data.value;
    }
    throw new Error('Invalid field type for segment map.');
  }

  getDataType(field: Field): 'ordinal' | 'quantitative' | 'nominal' {
    if (field.isString()) {
      return 'nominal';
    } else if (field.isNumber()) {
      return 'quantitative';
    }
    // TODO dates nominal?
    throw new Error('Invalid field type for segment map.');
  }

  getVegaLiteSpec(data: Cell): lite.TopLevelSpec {
    if (!data.isRepeatedRecord()) {
      throw new Error('Expected struct value not to be null.');
    }

    const fields = data.field.fields;

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

export class SegmentMapRendererFactory extends RendererFactory<SegmentMapRenderOptions> {
  public static readonly instance = new SegmentMapRendererFactory();

  create(
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    _field: Field,
    options: SegmentMapRenderOptions,
    timezone?: string
  ): Renderer {
    return new HTMLSegmentMapRenderer(
      document,
      styleDefaults,
      rendererOptions,
      options,
      timezone
    );
  }

  get rendererName() {
    return 'segment_map';
  }
}
