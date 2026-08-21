/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Tag} from '@malloydata/malloy-tag';
import type {ComboChartSettings, ComboYChannel} from './combo-chart-settings';
import {defaultComboChartSettings} from './combo-chart-settings';
import {extractFieldName} from '@/plugins/extract-field-name';

export function comboChartSettingsToTag(settings: ComboChartSettings): Tag {
  let tag = new Tag({
    properties: {
      viz: {eq: 'combo'},
    },
  });

  // X channel field
  if (settings.xChannel?.fields?.length > 0) {
    tag = tag.set(['viz', 'x'], extractFieldName(settings.xChannel.fields[0]));
  }

  // Left / right measure channels (single value or array)
  const setChannel = (channel: 'y' | 'y2', fields: string[]) => {
    if (fields.length === 1) {
      tag = tag.set(['viz', channel], extractFieldName(fields[0]));
    } else if (fields.length > 1) {
      tag = tag.set(['viz', channel], fields.map(extractFieldName));
    }
  };
  setChannel('y', settings.yChannel?.fields ?? []);
  setChannel('y2', settings.y2Channel?.fields ?? []);

  // Mark types, only when they differ from the per-channel defaults
  if (settings.yChannel?.chart !== defaultComboChartSettings.yChannel.chart) {
    tag = tag.set(['viz', 'y', 'chart'], settings.yChannel.chart);
  }
  if (settings.y2Channel?.chart !== defaultComboChartSettings.y2Channel.chart) {
    tag = tag.set(['viz', 'y2', 'chart'], settings.y2Channel.chart);
  }

  // Line styling, only when set (line-only; a no-op for bar channels).
  const setLineStyle = (channel: 'y' | 'y2', ch?: ComboYChannel) => {
    if (!ch) return;
    if (ch.lineWidth !== undefined) {
      tag = tag.set(['viz', channel, 'line_width'], ch.lineWidth.toString());
    }
    if (ch.showPoints !== undefined) {
      tag = tag.set(
        ['viz', channel, 'points'],
        ch.showPoints ? 'true' : 'false'
      );
    }
  };
  setLineStyle('y', settings.yChannel);
  setLineStyle('y2', settings.y2Channel);

  // Explicit axis bounds, only when set.
  const setAxisBounds = (channel: 'y' | 'y2', ch?: ComboYChannel) => {
    if (!ch) return;
    if (ch.min !== undefined) {
      tag = tag.set(['viz', channel, 'min'], ch.min.toString());
    }
    if (ch.max !== undefined) {
      tag = tag.set(['viz', channel, 'max'], ch.max.toString());
    }
  };
  setAxisBounds('y', settings.yChannel);
  setAxisBounds('y2', settings.y2Channel);

  // Independence settings, only when non-default
  if (
    settings.yChannel?.independent !==
    defaultComboChartSettings.yChannel.independent
  ) {
    tag = tag.set(
      ['viz', 'y', 'independent'],
      settings.yChannel.independent ? 'true' : 'false'
    );
  }
  if (
    settings.y2Channel?.independent !==
    defaultComboChartSettings.y2Channel.independent
  ) {
    tag = tag.set(
      ['viz', 'y2', 'independent'],
      settings.y2Channel.independent ? 'true' : 'false'
    );
  }
  if (
    settings.xChannel?.independent !==
    defaultComboChartSettings.xChannel.independent
  ) {
    tag = tag.set(
      ['viz', 'x', 'independent'],
      settings.xChannel.independent === true ? 'true' : 'false'
    );
  }

  // X-axis limit if non-default
  if (settings.xChannel?.limit !== defaultComboChartSettings.xChannel.limit) {
    tag = tag.set(['viz', 'x', 'limit'], settings.xChannel.limit.toString());
  }

  return tag;
}
