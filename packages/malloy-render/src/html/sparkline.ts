/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as lite from 'vega-lite';
import {HTMLLineChartRenderer} from './line_chart';
import {getColorScale} from './utils';
import {DEFAULT_SPEC} from './vega_spec';
import type {SparkLineRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import {RendererFactory} from './renderer_factory';
import type {Cell, Field} from '../data_tree';

export class HTMLSparkLineRenderer extends HTMLLineChartRenderer {
  override getSize(): {height: number; width: number} {
    if (this.size === 'large') {
      return {height: 100, width: 250};
    } else {
      return {height: 50, width: 125};
    }
  }

  override getVegaLiteSpec(data: Cell): lite.TopLevelSpec {
    if (!data.isRecordOrRepeatedRecord()) {
      throw new Error('Sparkline only supports nests');
    }
    const fields = data.field.fields;
    const xField = fields[0];
    const yField = fields[1];
    const colorField = fields[2];

    const xType = this.getDataType(xField);
    const yType = this.getDataType(yField);
    const colorType = colorField ? this.getDataType(colorField) : undefined;

    const colorDef =
      colorField !== undefined
        ? {
            field: colorField.name,
            type: colorType,
            axis: {title: null},
            scale: getColorScale(colorType, false),
          }
        : {value: '#4285F4'};

    const xSort = xType === 'nominal' ? null : undefined;
    const ySort = yType === 'nominal' ? null : undefined;

    const xDef = {
      field: xField.name,
      type: xType,
      sort: xSort,
      axis: {
        title: null,
        domain: false,
        grid: false,
        lables: false,
        ticks: false,
        values: [],
      },
      scale: {zero: false},
    };

    const yDef = {
      field: yField.name,
      type: yType,
      sort: ySort,
      axis: {
        title: null,
        domain: false,
        ticks: false,
        grid: false,
        lables: false,
        values: [],
      },
      scale: {zero: false},
    };

    return {
      ...DEFAULT_SPEC,
      ...this.getSize(),
      data: {
        values: this.mapData(data.rows),
      },
      config: {
        view: {
          stroke: 'transparent',
        },
      },
      mark: {
        type: 'line',
        tooltip: true,
      },
      encoding: {
        x: xDef,
        y: yDef,
        color: colorDef,
      },
      background: 'transparent',
    };
  }
}

export class SparkLineRendererFactory extends RendererFactory<SparkLineRenderOptions> {
  public static readonly instance = new SparkLineRendererFactory();

  create(
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    _field: Field,
    options: SparkLineRenderOptions,
    timezone?: string
  ): Renderer {
    return new HTMLSparkLineRenderer(
      document,
      styleDefaults,
      rendererOptions,
      options,
      timezone
    );
  }

  get rendererName() {
    return 'sparkline';
  }
}
