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
import * as vega from 'vega';
import type {Renderer} from './renderer';
import type {RendererOptions} from './renderer_types';
import type {ChartRenderOptions, StyleDefaults} from './data_styles';
import {normalizeToTimezone} from '../html/utils';
import {mergeVegaConfigs} from '../component/vega/merge-vega-configs';
import type {Cell, Field, RecordCell} from '../data_tree';

type MappedRow = {[p: string]: string | number | Date | undefined | null};

export abstract class HTMLChartRenderer implements Renderer {
  size: string;
  chartOptions: ChartRenderOptions;
  abstract getDataType(
    field: Field
  ): 'temporal' | 'ordinal' | 'quantitative' | 'nominal';

  abstract getDataValue(data: Cell): Date | string | number | null | undefined;

  mapData(data: RecordCell[]): MappedRow[] {
    const mappedRows: MappedRow[] = [];
    for (const row of data) {
      const mappedRow: {
        [p: string]: string | number | Date | undefined | null;
      } = {};
      for (const f of row.field.fields) {
        let dataValue = this.getDataValue(row.column(f.name));
        if (dataValue instanceof Date) {
          dataValue = normalizeToTimezone(dataValue, this.timezone);
        }

        mappedRow[f.name] = dataValue;
      }
      mappedRows.push(mappedRow);
    }
    return mappedRows;
  }

  getSize(): {height: number; width: number} {
    if (this.size === 'large') {
      return {height: 350, width: 500};
    } else {
      return {height: 175, width: 250};
    }
  }

  constructor(
    protected readonly document: Document,
    protected styleDefaults: StyleDefaults,
    protected options: RendererOptions,
    chartOptions: ChartRenderOptions = {},
    protected timezone?: string
  ) {
    this.size = chartOptions.size || this.styleDefaults.size || 'medium';
    this.chartOptions = chartOptions;
  }

  abstract getVegaLiteSpec(data: Cell): lite.TopLevelSpec;

  async render(table: Cell): Promise<HTMLElement> {
    if (!table.isRepeatedRecord()) {
      throw new Error('Invalid type for chart renderer');
    }

    const spec = this.getVegaLiteSpec(table);
    spec.config = mergeVegaConfigs(
      spec.config ?? {},
      this.chartOptions.vegaConfigOverride ?? {}
    );

    const vegaspec = lite.compile(spec, {
      logger: {
        level(newLevel: number) {
          if (newLevel !== undefined) {
            return this;
          }
          return 0;
        },
        info() {
          return this;
        },
        error() {
          return this;
        },
        warn() {
          return this;
        },
        debug() {
          return this;
        },
      } as vega.LoggerInterface,
    }).spec;
    const view = new vega.View(vega.parse(vegaspec), {
      renderer: 'none',
    });
    view.logger().level(-1);
    const element = this.document.createElement('div');
    element.innerHTML = await view.toSVG();
    return element;
  }
}
