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
import {LitElement, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import './vega-chart';
import {DataArray, ExploreField} from '@malloydata/malloy';
import {RenderResultMetadata} from './render-result-metadata';
import {getChartSettings} from './chart-settings';
import {baseSpec} from './vega-lite-base-spec';
import {valueIsNumber, valueIsString} from './util';

@customElement('malloy-bar-chart')
export class BarChart extends LitElement {
  @property({attribute: false})
  data!: DataArray;

  @property({attribute: false})
  metadata!: RenderResultMetadata;

  override render() {
    const field = this.data.field as ExploreField;
    const keys = field.allFields;
    const {tag} = field.tagParse();
    const isSpark = tag.text('size') === 'spark';
    const chartSettings = getChartSettings(field, this.metadata);

    const records: Partial<{barDim: string; sizeMeasure: number}>[] = [];
    for (const rec of this.data) {
      const record: Partial<{barDim: string; sizeMeasure: number}> = {};
      const xValue = rec.cell(chartSettings.xField.name).value;
      const yValue = rec.cell(chartSettings.yField.name).value;
      if (valueIsString(chartSettings.xField, xValue)) {
        record.barDim = xValue;
      }
      if (valueIsNumber(chartSettings.yField, yValue)) {
        record.sizeMeasure = yValue;
      }
      records.push(record);
    }

    const spec = baseSpec();
    spec.data = {
      values: records,
    };

    spec.layer = [
      {
        mark: {
          type: 'bar',
          width: {'band': 0.8},
          cornerRadiusEnd: 0,
        },
        encoding: {
          x: {
            field: 'barDim',
            type: 'nominal',
            sort: null, // Uses the sort order of underlying data
            axis: {
              labelAngle: chartSettings.xAxis.labelAngle,
              maxExtent: chartSettings.xAxis.height,
              labelLimit: chartSettings.xAxis.labelSize,
              title: keys[0].name,
            },
            scale: {},
          },
          y: {
            field: 'sizeMeasure',
            type: 'quantitative',
            scale: {
              domain: chartSettings.yScale.domain,
            },
            axis: {
              maxExtent: chartSettings.yAxis.width,
              labelLimit: chartSettings.yAxis.width + 10,
              tickCount: chartSettings.yAxis.tickCount,
              title: keys[1].name,
            },
          },
          // TODO: fill color from theme
          fill: {value: '#53B2C8'},
        },
      },
    ];

    if (isSpark) {
      spec.padding = 0;
      spec.layer[0].encoding.y.axis = null;
    } else {
      spec.padding = chartSettings.padding;
    }

    return html`<div style="">
      <malloy-vega-chart
        .spec="${spec}"
        type="vega-lite"
        width="${chartSettings.plotWidth}"
        height="${chartSettings.plotHeight}"
      ></malloy-vega-chart>
    </div>`;
  }
}
