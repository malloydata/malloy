/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
import type {MalloyExplicitTheme} from '@/api/types';

export type GetResultMetadataOptions = {
  renderFieldMetadata: RenderFieldMetadata;
  getVegaConfigOverride?: VegaConfigHandler;
  parentSize: {width: number; height: number};
  useVegaInterpreter?: boolean;
  /**
   * Operator-level theme passed by the embedding app (e.g. Publisher).
   * The `# shape_map` and `# segment_map` plugins build their own
   * colour scales and forward this to {@link getColorScale} so the
   * gradient picks up the operator's `mapColor` instead of the
   * hardcoded blue ramp.
   */
  explicitTheme?: MalloyExplicitTheme;
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
        : (chartSizingStrategy ?? rootSizingStrategy),
    renderFieldMetadata: options.renderFieldMetadata,
    styleOverrides: {},
  };

  return metadata;
}

export function shouldRenderChartAs(tag: Tag): string | undefined {
  const normalizedTag = convertLegacyToVizTag(tag);

  return getChartTypeFromNormalizedTag(normalizedTag);
}
