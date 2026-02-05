/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {tagFromLine} from '@malloydata/malloy-tag';
import type {LineChartSettings} from './line-chart-settings';
import {defaultLineChartSettings} from './line-chart-settings';
import {lineChartSettingsToTag} from './settings-to-tag';

describe('LineChartPlugin settingsToTag', () => {
  test('should create basic line chart tag with defaults', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
    };

    const tag = lineChartSettingsToTag(settings);

    expect(tag.text('viz')).toBe('line');
  });

  test('should add x channel field', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      xChannel: {
        ...defaultLineChartSettings.xChannel,
        fields: ['date_field'],
      },
    };

    const tag = lineChartSettingsToTag(settings);

    expect(tag.text('viz', 'x')).toBe('date_field');
  });

  test('should add single y channel field', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      yChannel: {
        ...defaultLineChartSettings.yChannel,
        fields: ['sales'],
      },
    };

    const tag = lineChartSettingsToTag(settings);

    expect(tag.text('viz', 'y')).toBe('sales');
  });

  test('should add multiple y channel fields as array', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      yChannel: {
        ...defaultLineChartSettings.yChannel,
        fields: ['sales', 'profit'],
      },
    };

    const tag = lineChartSettingsToTag(settings);

    const yArray = tag.array('viz', 'y');
    expect(yArray).toBeDefined();
    expect(yArray?.length).toBe(2);
    expect(yArray?.[0].text()).toBe('sales');
    expect(yArray?.[1].text()).toBe('profit');
  });

  test('should add series channel field', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      seriesChannel: {
        ...defaultLineChartSettings.seriesChannel,
        fields: ['category'],
      },
    };

    const tag = lineChartSettingsToTag(settings);

    expect(tag.text('viz', 'series')).toBe('category');
  });

  test('should add zero_baseline when different from default', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      zeroBaseline: true, // default is false
    };

    const tag = lineChartSettingsToTag(settings);

    expect(tag.text('viz', 'zero_baseline')).toBe('true');
  });

  test('should not add zero_baseline when same as default', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      zeroBaseline: false, // same as default
    };

    const tag = lineChartSettingsToTag(settings);

    expect(tag.has('viz', 'zero_baseline')).toBe(false);
  });

  test('should add x independence when different from default', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      xChannel: {
        ...defaultLineChartSettings.xChannel,
        independent: true, // default is 'auto'
      },
    };

    const tag = lineChartSettingsToTag(settings);

    expect(tag.text('viz', 'x', 'independent')).toBe('true');
  });

  test('should add y independence when different from default', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      yChannel: {
        ...defaultLineChartSettings.yChannel,
        independent: true, // default is false
      },
    };

    const tag = lineChartSettingsToTag(settings);

    expect(tag.text('viz', 'y', 'independent')).toBe('true');
  });

  test('should add series independence when different from default', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      seriesChannel: {
        ...defaultLineChartSettings.seriesChannel,
        independent: false, // default is 'auto'
      },
    };

    const tag = lineChartSettingsToTag(settings);

    expect(tag.text('viz', 'series', 'independent')).toBe('false');
  });

  test('should add series limit when different from default', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      seriesChannel: {
        ...defaultLineChartSettings.seriesChannel,
        limit: 5, // default is 'auto'
      },
    };

    const tag = lineChartSettingsToTag(settings);

    expect(tag.text('viz', 'series', 'limit')).toBe('5');
  });

  test('should create complete tag with all settings', () => {
    const settings: LineChartSettings = {
      xChannel: {
        fields: ['month'],
        type: 'nominal',
        independent: true,
      },
      yChannel: {
        fields: ['revenue', 'cost'],
        type: 'quantitative',
        independent: true,
      },
      seriesChannel: {
        fields: ['product_category'],
        type: 'nominal',
        independent: false,
        limit: 10,
      },
      zeroBaseline: true,
      interactive: true,
      disableEmbedded: false,
    };

    const tag = lineChartSettingsToTag(settings);

    // Basic structure
    expect(tag.text('viz')).toBe('line');

    // Fields
    expect(tag.text('viz', 'x')).toBe('month');
    expect(tag.text('viz', 'series')).toBe('product_category');

    // Y fields as array
    const yArray = tag.array('viz', 'y');
    expect(yArray).toBeDefined();
    expect(yArray?.length).toBe(2);
    expect(yArray?.[0].text()).toBe('revenue');
    expect(yArray?.[1].text()).toBe('cost');

    // Settings
    expect(tag.text('viz', 'zero_baseline')).toBe('true');
    expect(tag.text('viz', 'x', 'independent')).toBe('true');
    expect(tag.text('viz', 'y', 'independent')).toBe('true');
    expect(tag.text('viz', 'series', 'independent')).toBe('false');
    expect(tag.text('viz', 'series', 'limit')).toBe('10');
  });

  test('should round trip: settings -> tag -> string representation', () => {
    const settings: LineChartSettings = {
      xChannel: {
        fields: ['date'],
        type: 'nominal',
        independent: true,
      },
      yChannel: {
        fields: ['sales'],
        type: 'quantitative',
        independent: false,
      },
      seriesChannel: {
        fields: ['region'],
        type: 'nominal',
        independent: 'auto',
        limit: 8,
      },
      zeroBaseline: true,
      interactive: true,
      disableEmbedded: false,
    };

    const tag = lineChartSettingsToTag(settings);
    const tagString = tag.toString();

    // Verify the string representation looks reasonable
    expect(tagString).toContain('viz = line');
    expect(tagString).toContain('x = date');
    expect(tagString).toContain('y = sales');
    expect(tagString).toContain('series = region');
    expect(tagString).toContain('zero_baseline = true');
    expect(tagString).toContain('limit = 8');

    // Parse it back to verify structure
    const parsedTag = tagFromLine(tagString).tag;
    expect(parsedTag.text('viz')).toBe('line');
    expect(parsedTag.text('viz', 'x')).toBe('date');
    expect(parsedTag.text('viz', 'y')).toBe('sales');
    expect(parsedTag.text('viz', 'series')).toBe('region');
  });

  test('should create proper array syntax for multiple y fields', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      yChannel: {
        ...defaultLineChartSettings.yChannel,
        fields: ['revenue', 'cost', 'profit margin'],
      },
    };

    const tag = lineChartSettingsToTag(settings);
    const tagString = tag.toString();

    // Should create proper array syntax without quotes around the array
    expect(tagString).toContain('y = [revenue, cost, "profit margin"]');

    // Verify the array can be parsed back
    const parsedTag = tagFromLine(tagString).tag;
    const yArray = parsedTag.array('viz', 'y');
    expect(yArray).toBeDefined();
    expect(yArray?.length).toBe(3);
    expect(yArray?.[0].text()).toBe('revenue');
    expect(yArray?.[1].text()).toBe('cost');
    expect(yArray?.[2].text()).toBe('profit margin');
  });

  test('should handle field paths as JSON-stringified arrays', () => {
    // This matches the format you're seeing in practice - field paths as JSON arrays
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      xChannel: {
        ...defaultLineChartSettings.xChannel,
        fields: ['["brand"]'], // Field path as JSON-stringified array
      },
      yChannel: {
        ...defaultLineChartSettings.yChannel,
        fields: ['["Sales $"]'], // Field path as JSON-stringified array
      },
    };

    const tag = lineChartSettingsToTag(settings);
    const tagString = tag.toString();

    // Should extract the field names from the paths
    expect(tagString).toContain('x = brand');
    expect(tagString).toContain('y = "Sales $"');
    expect(tagString).not.toContain('["brand"]');
    expect(tagString).not.toContain('["Sales $"]');

    // Verify the values can be parsed back correctly
    const parsedTag = tagFromLine(tagString).tag;
    expect(parsedTag.text('viz', 'x')).toBe('brand');
    expect(parsedTag.text('viz', 'y')).toBe('Sales $');
  });

  test('should handle multiple y field paths', () => {
    const settings: LineChartSettings = {
      ...defaultLineChartSettings,
      yChannel: {
        ...defaultLineChartSettings.yChannel,
        fields: ['["Revenue"]', '["Cost"]', '["Profit Margin"]'], // Multiple field paths
      },
    };

    const tag = lineChartSettingsToTag(settings);
    const tagString = tag.toString();

    // Should create proper array syntax with extracted field names
    expect(tagString).toContain('y = [Revenue, Cost, "Profit Margin"]');

    // Verify the array can be parsed back
    const parsedTag = tagFromLine(tagString).tag;
    const yArray = parsedTag.array('viz', 'y');
    expect(yArray).toBeDefined();
    expect(yArray?.length).toBe(3);
    expect(yArray?.[0].text()).toBe('Revenue');
    expect(yArray?.[1].text()).toBe('Cost');
    expect(yArray?.[2].text()).toBe('Profit Margin');
  });
});
