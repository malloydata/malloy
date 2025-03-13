/*
 * Copyright 2023 Google LLC
 * Copyright (c) Meta Platforms, Inc. and affiliates.
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

import type {Tag} from '@malloydata/malloy-tag';
import type {VegaChartProps, VegaConfigHandler} from './types';
import {mergeVegaConfigs} from './vega/merge-vega-configs';
import {baseVegaConfig} from './vega/base-vega-config';
import {generateBarChartVegaSpec} from './bar-chart/generate-bar_chart-vega-spec';
import type {ResultStore} from './result-store/result-store';
import {createResultStore} from './result-store/result-store';
import {generateLineChartVegaSpec} from './line-chart/generate-line_chart-vega-spec';
import type {Config, Runtime} from 'vega';
import {parse} from 'vega';
import type {NestField, RepeatedRecordField, RootCell} from '../data_tree';

export type GetResultMetadataOptions = {
  getVegaConfigOverride?: VegaConfigHandler;
};

export interface FieldVegaInfo {
  runtime: Runtime;
  props: VegaChartProps;
}

export interface RenderMetadata {
  store: ResultStore;
  vega: Record<string, FieldVegaInfo>;
  root: RootCell;
}

export function getResultMetadata(
  root: RootCell,
  options: GetResultMetadataOptions = {}
): RenderMetadata {
  const metadata: RenderMetadata = {
    store: createResultStore(),
    vega: {},
    root,
  };
  populateAllVegaSpecs(root.field, metadata, options);

  return metadata;
}

function populateAllVegaSpecs(
  root: NestField,
  metadata: RenderMetadata,
  options: GetResultMetadataOptions
): void {
  if (root.isRepeatedRecord()) {
    populateVegaSpec(root, metadata, options);
  }
  root.fields.forEach(f => {
    if (f.isNest()) {
      populateAllVegaSpecs(f, metadata, options);
    }
  });
}

const CHART_TAG_LIST = ['bar_chart', 'line_chart'];

export function shouldRenderChartAs(tag: Tag) {
  const tagNamesInOrder = Object.keys(tag.properties ?? {}).reverse();
  return tagNamesInOrder.find(name => CHART_TAG_LIST.includes(name));
}

function populateVegaSpec(
  field: RepeatedRecordField,
  metadata: RenderMetadata,
  options: GetResultMetadataOptions
) {
  // Populate vega spec data
  let vegaChartProps: VegaChartProps | null = null;
  const chartType = shouldRenderChartAs(field.tag);
  if (chartType === 'bar_chart') {
    vegaChartProps = generateBarChartVegaSpec(field);
  } else if (chartType === 'line_chart') {
    vegaChartProps = generateLineChartVegaSpec(field);
  }

  if (vegaChartProps) {
    const vegaConfigOverride =
      options.getVegaConfigOverride?.(vegaChartProps.chartType) ?? {};

    const vegaConfig: Config = mergeVegaConfigs(
      baseVegaConfig(),
      options.getVegaConfigOverride?.(vegaChartProps.chartType) ?? {}
    );

    const maybeAxisYLabelFont = vegaConfigOverride['axisY']?.['labelFont'];
    const maybeAxisLabelFont = vegaConfigOverride['axis']?.['labelFont'];
    if (maybeAxisYLabelFont || maybeAxisLabelFont) {
      const refLineFontSignal = vegaConfig.signals?.find(
        signal => signal.name === 'referenceLineFont'
      );
      if (refLineFontSignal)
        refLineFontSignal.value = maybeAxisYLabelFont ?? maybeAxisLabelFont;
    }

    const props = {
      ...vegaChartProps,
      spec: {
        ...vegaChartProps.spec,
        config: vegaConfig,
      },
    };
    const runtime = parse(props.spec);
    metadata.vega[field.key] = {runtime, props};
  }
}
