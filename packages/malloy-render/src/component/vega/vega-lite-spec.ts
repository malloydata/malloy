/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Spec-building helpers for the Vega-Lite charts drawn by VegaLiteChart, kept
// apart from that component so spec code and its tests need no Solid.

import type {Config} from 'vega';
import {baseVegaConfig} from './base-vega-config';
import {mergeVegaConfigs} from './merge-vega-configs';

/** The data source a live Vega-Lite spec reads its rows from. */
export const VEGA_LITE_VALUES = 'values';

/** The first color of the theme's category palette. */
export function firstSeriesColor(
  vegaConfigOverride: Record<string, unknown>
): string {
  const config = mergeVegaConfigs(
    baseVegaConfig(),
    vegaConfigOverride
  ) as Config;
  const category = config.range?.category;
  return Array.isArray(category) && typeof category[0] === 'string'
    ? category[0]
    : (baseVegaConfig().range!.category as string[])[0];
}
