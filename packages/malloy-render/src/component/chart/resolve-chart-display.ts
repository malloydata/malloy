/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {NestField} from '@/data_tree';

export interface ChartSizeConfig {
  width?: number;
  height?: number;
  preset?: string;
}

export interface ChartDisplayConfig {
  title?: string;
  subtitle?: string;
  size: ChartSizeConfig;
}

/**
 * Setup-time resolver for chart display tags (title, subtitle, size).
 *
 * Reads the `viz.title`, `viz.subtitle`, `viz.size.*` properties plus the
 * legacy top-level `size.*` fallback. Called from each chart plugin's
 * `create()` so the reads happen during `setResult()` — no tag access
 * needed at render time for these paths.
 */
export function resolveChartDisplayConfig(
  field: NestField,
  chartTag: Tag
): ChartDisplayConfig {
  const fieldTag = field.tag;
  const width =
    chartTag.numeric('size', 'width') ?? fieldTag.numeric('size', 'width');
  const height =
    chartTag.numeric('size', 'height') ?? fieldTag.numeric('size', 'height');
  const preset = chartTag.text('size') ?? fieldTag.text('size');

  return {
    title: chartTag.text('title'),
    subtitle: chartTag.text('subtitle'),
    size: {
      width: width ?? undefined,
      height: height ?? undefined,
      preset: preset ?? undefined,
    },
  };
}
