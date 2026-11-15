/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {CATEGORY_PALETTE} from './base-vega-config';
import {chartVegaConfig} from './vega-lite-spec';

describe('chartVegaConfig', () => {
  const chartConfig = {axis: {labelFont: 'chart font', titleFontSize: 12}};

  test("without an override, series colors are the base theme's", () => {
    const config = chartVegaConfig(chartConfig, {});
    expect(config.range?.category).toEqual(CATEGORY_PALETTE);
    expect(config.axis).toMatchObject({
      labelFont: 'chart font',
      gridColor: '#E5E7EB',
    });
  });

  test("a host's override outranks the chart's own config", () => {
    // The shape of the override Publisher sends.
    const config = chartVegaConfig(chartConfig, {
      font: 'Host Sans',
      axis: {labelFont: 'Host Sans', labelColor: '#111111'},
      range: {category: ['#AA0000', '#00AA00']},
    });
    expect(config.range?.category).toEqual(['#AA0000', '#00AA00']);
    expect(config.axis).toMatchObject({
      labelFont: 'Host Sans',
      labelColor: '#111111',
      titleFontSize: 12,
    });
  });

  test('an override may name a color scheme', () => {
    const config = chartVegaConfig(undefined, {
      range: {category: {scheme: 'tableau10'}},
    });
    expect(config.range?.category).toMatchObject({scheme: 'tableau10'});
  });
});
