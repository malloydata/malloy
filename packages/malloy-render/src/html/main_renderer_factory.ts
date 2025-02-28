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

import {Tag} from '@malloydata/malloy-tag';
import {DataRenderOptions, RenderDef, StyleDefaults} from './data_styles';
import {Renderer} from './renderer';
import {RendererFactory} from './renderer_factory';
import {RendererOptions} from './renderer_types';
import {ShapeMapRendererFactory} from './shape_map';
import {PointMapRendererFactory} from './point_map';
import {ImageRendererFactory} from './image';
import {SegmentMapRendererFactory} from './segment_map';
import {JSONRendererFactory} from './json';
import {SparkLineRendererFactory} from './sparkline';
import {BarSparkLineRendererFactory} from './bar_sparkline';
import {AreaSparkLineRendererFactory} from './area_sparkline';
import {ColumnSparkLineRendererFactory} from './column_sparkline';
import {ScatterChartRendererFactory} from './scatter_chart';
import {BarChartRendererFactory} from './bar_chart';
import {VegaRendererFactory} from './vega_spec';
import {LineChartRendererFactory} from './line_chart';
import {DateRendererFactory} from './date';
import {CurrencyRendererFactory} from './currency';
import {PercentRendererFactory} from './percent';
import {NumberRendererFactory} from './number';
import {BytesRendererFactory} from './bytes';
import {BooleanRendererFactory} from './boolean';
import {LinkRendererFactory} from './link';
import {UnsupportedRendererFactory} from './unsupported';
import {TextRendererFactory} from './text';
import {DataVolumeRendererFactory} from './data_volume';
import {DurationRendererFactory} from './duration';
import * as Malloy from '@malloydata/malloy-interfaces';

export class MainRendererFactory {
  static renderFactories = [
    ShapeMapRendererFactory.instance,
    PointMapRendererFactory.instance,
    ImageRendererFactory.instance,
    SegmentMapRendererFactory.instance,
    JSONRendererFactory.instance,
    LineChartRendererFactory.instance,
    ColumnSparkLineRendererFactory.instance,
    BarSparkLineRendererFactory.instance,
    AreaSparkLineRendererFactory.instance,
    // This factory needs to be after the other Spark Line factories, so it doesn't override them.
    SparkLineRendererFactory.instance,
    ScatterChartRendererFactory.instance,
    BarChartRendererFactory.instance,
    VegaRendererFactory.instance,
    DateRendererFactory.instance,
    CurrencyRendererFactory.instance,
    PercentRendererFactory.instance,
    DataVolumeRendererFactory.instance,
    BytesRendererFactory.instance,
    LinkRendererFactory.instance,
    DurationRendererFactory.instance,
    BooleanRendererFactory.instance,
    NumberRendererFactory.instance,
    UnsupportedRendererFactory.instance,
    TextRendererFactory.instance,
  ];

  create(
    renderDef: RenderDef | undefined,
    tagged: Tag,
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    field: Malloy.DimensionInfo,
    timezone?: string | undefined
  ): Renderer | undefined {
    let factory: RendererFactory<DataRenderOptions> | undefined;

    for (const f of MainRendererFactory.renderFactories) {
      if (
        ((this.matchesRenderDef(renderDef, f) || this.matchesTag(tagged, f)) &&
          f.isValidMatch(field)) ||
        f.activates(field)
      ) {
        factory = f;
        // Important to break so the first factory that matches is applied.
        break;
      }
    }
    return factory?.create(
      document,
      styleDefaults,
      rendererOptions,
      field,
      renderDef || factory.parseTagParameters(tagged) || {},
      timezone
    );
  }

  matchesRenderDef(
    renderDef: RenderDef | undefined,
    factory: RendererFactory<DataRenderOptions>
  ) {
    return (
      renderDef &&
      factory.rendererName &&
      renderDef.renderer === factory.rendererName
    );
  }

  matchesTag(tagged: Tag, factory: RendererFactory<DataRenderOptions>) {
    return factory.rendererName && tagged.has(factory.rendererName);
  }
}
