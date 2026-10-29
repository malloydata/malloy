/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as lite from 'vega-lite';
import {getColorScale} from './utils';
import {DEFAULT_SPEC} from './vega_spec';
import {HTMLBarChartRenderer} from './bar_chart';
import type {BarSparkLineRenderOptions, StyleDefaults} from './data_styles';
import {RendererFactory} from './renderer_factory';
import type {RendererOptions} from './renderer_types';
import type {Renderer} from './renderer';
import type {Cell, Field} from '../data_tree';

export class HTMLBarSparkLineRenderer extends HTMLBarChartRenderer {
  override getSize(): {height: number; width: number} {
    if (this.size === 'large') {
      return {height: 250, width: 100};
    } else {
      return {height: 125, width: 50};
    }
  }

  override getVegaLiteSpec(data: Cell): lite.TopLevelSpec {
    if (!data.isRepeatedRecord()) {
      throw new Error('BarSparkLineRenderer only supports nest fields');
    }
    const fields = data.field.fields;
    const xField = fields[0];
    const yField = fields[1];
    const colorField = fields[2];

    const xType = this.getDataType(xField);
    const yType = this.getDataType(yField);
    const colorType = colorField ? this.getDataType(colorField) : undefined;

    const mark = {type: this.getMark(), tooltip: true};

    const colorDef =
      colorField !== undefined
        ? {
            field: colorField.name,
            type: colorType,
            axis: {title: null},
            scale: getColorScale(colorType, true),
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
      mark,
      encoding: {
        y: xDef,
        x: yDef,
        color: colorDef,
      },
      background: 'transparent',
    };
  }
}

export class BarSparkLineRendererFactory extends RendererFactory<BarSparkLineRenderOptions> {
  public static readonly instance = new BarSparkLineRendererFactory();

  isValidMatch(field: Field): boolean {
    return field.name.endsWith('_bar');
  }

  create(
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    _field: Field,
    options: BarSparkLineRenderOptions,
    timezone?: string
  ): Renderer {
    return new HTMLBarSparkLineRenderer(
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
