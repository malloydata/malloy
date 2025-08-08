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
import type {ResultStore} from '@/component/result-store/result-store';
import {createResultStore} from '@/component/result-store/result-store';
import type {Runtime} from 'vega';
import {defaultSettings} from '@/component/default-settings';
import {
  convertLegacyToVizTag,
  getChartTypeFromNormalizedTag,
} from './tag-utils';
import type {RootField} from '@/data_tree';
import type {RenderFieldMetadata} from '@/render-field-metadata';

export type GetResultMetadataOptions = {
  renderFieldMetadata: RenderFieldMetadata;
  getVegaConfigOverride?: VegaConfigHandler;
  parentSize: {width: number; height: number};
  useVegaInterpreter?: boolean;
};

export interface FieldVegaInfo {
  runtime: Runtime | null;
  props: VegaChartProps | null;
  error: Error | null;
}

export interface RenderMetadata {
  store: ResultStore;
  vega: Record<string, FieldVegaInfo>;
  rootField: RootField;
  parentSize: {width: number; height: number};
  renderAs: string;
  sizingStrategy: 'fill' | 'fixed';
  renderFieldMetadata: RenderFieldMetadata;
  styleOverrides: Record<string, string>;
}

export function getResultMetadata(
  rootField: RootField,
  options: GetResultMetadataOptions
): RenderMetadata {
  const rootTag = rootField.tag;

  const rootSizingStrategy =
    rootTag.has('size') && rootTag.text('size') !== 'fill'
      ? 'fixed'
      : defaultSettings.size;
  const chartSizeTag = rootTag.tag('viz', 'size');
  const chartSizingStrategy =
    chartSizeTag && chartSizeTag.text('') !== 'fill' ? 'fixed' : null;

  const renderAs = rootField.renderAs();

  const metadata: RenderMetadata = {
    store: createResultStore(),
    vega: {},
    rootField,
    parentSize: options.parentSize,
    renderAs,
    sizingStrategy:
      renderAs === 'table'
        ? 'fixed'
        : chartSizingStrategy ?? rootSizingStrategy,
    renderFieldMetadata: options.renderFieldMetadata,
    styleOverrides: {},
  };

  return metadata;
}

export function shouldRenderChartAs(tag: Tag): string | undefined {
  const normalizedTag = convertLegacyToVizTag(tag);

  return getChartTypeFromNormalizedTag(normalizedTag);
}
