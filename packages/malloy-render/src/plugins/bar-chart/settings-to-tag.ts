/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Tag} from '@malloydata/malloy-tag';
import type {BarChartSettings} from './bar-chart-settings';
import {defaultBarChartSettings} from './bar-chart-settings';

function extractFieldName(fieldPath: string): string {
  try {
    const parsed = JSON.parse(fieldPath);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed[parsed.length - 1];
    }
  } catch {
    // If parsing fails, treat as regular string
  }
  return fieldPath;
}

export function barChartSettingsToTag(settings: BarChartSettings): Tag {
  let tag = new Tag({
    properties: {
      viz: {eq: 'bar'},
    },
  });

  // Add x channel field
  if (settings.xChannel?.fields?.length > 0) {
    const fieldName = extractFieldName(settings.xChannel.fields[0]);
    tag = tag.set(['viz', 'x'], fieldName);
  }

  // Add y channel fields
  if (settings.yChannel?.fields?.length > 0) {
    if (settings.yChannel.fields.length === 1) {
      const fieldName = extractFieldName(settings.yChannel.fields[0]);
      tag = tag.set(['viz', 'y'], fieldName);
    } else {
      // For multiple fields, extract field names from each path
      const fieldNames = settings.yChannel.fields.map(extractFieldName);
      tag = tag.set(['viz', 'y'], fieldNames);
    }
  }

  // Add series channel field
  if (settings.seriesChannel?.fields?.length > 0) {
    const fieldName = extractFieldName(settings.seriesChannel.fields[0]);
    tag = tag.set(['viz', 'series'], fieldName);
  }

  // Add stack if different from default
  if (settings.isStack !== defaultBarChartSettings.isStack) {
    tag = tag.set(['viz', 'stack'], null);
  }

  // Add hide references if different from default
  if (settings.hideReferences !== defaultBarChartSettings.hideReferences) {
    if (settings.hideReferences) {
      tag = tag.set(['viz', 'size'], 'spark');
    }
  }

  // Add independence settings if different from default
  if (
    settings.xChannel?.independent !==
    defaultBarChartSettings.xChannel.independent
  ) {
    const value = settings.xChannel.independent === true ? 'true' : 'false';
    tag = tag.set(['viz', 'x', 'independent'], value);
  }

  if (
    settings.yChannel?.independent !==
    defaultBarChartSettings.yChannel.independent
  ) {
    const value = settings.yChannel.independent ? 'true' : 'false';
    tag = tag.set(['viz', 'y', 'independent'], value);
  }

  if (
    settings.seriesChannel?.independent !==
    defaultBarChartSettings.seriesChannel.independent
  ) {
    const value =
      settings.seriesChannel.independent === true ? 'true' : 'false';
    tag = tag.set(['viz', 'series', 'independent'], value);
  }

  // Add series limit if different from default
  if (
    settings.seriesChannel?.limit !==
    defaultBarChartSettings.seriesChannel.limit
  ) {
    tag = tag.set(
      ['viz', 'series', 'limit'],
      settings.seriesChannel.limit.toString()
    );
  }

  // Add y2 channel fields
  if (settings.y2Channel?.fields?.length) {
    if (settings.y2Channel.fields.length === 1) {
      const fieldName = extractFieldName(settings.y2Channel.fields[0]);
      tag = tag.set(['viz', 'y2'], fieldName);
    } else {
      const fieldNames = settings.y2Channel.fields.map(extractFieldName);
      tag = tag.set(['viz', 'y2'], fieldNames);
    }
  }

  // Add layout if horizontal
  if (settings.layout === 'horizontal') {
    tag = tag.set(['viz', 'layout'], 'horizontal');
  }

  // Add yScaleType if set
  if (settings.yScaleType && settings.yScaleType !== 'linear') {
    tag = tag.set(['viz', 'y', 'scale'], settings.yScaleType);
  }

  // Add colorScheme if set
  if (settings.colorScheme) {
    tag = tag.set(['viz', 'colorScheme'], settings.colorScheme);
  }

  // Add colors if set
  if (settings.colors && settings.colors.length > 0) {
    tag = tag.set(['viz', 'colors'], settings.colors);
  }

  // Add reference lines
  if (settings.referenceLines && settings.referenceLines.length > 0) {
    const refLine = settings.referenceLines[0];
    tag = tag.set(['viz', 'reference_line', 'y'], refLine.y.toString());
    if (refLine.label) {
      tag = tag.set(['viz', 'reference_line', 'label'], refLine.label);
    }
    if (refLine.color) {
      tag = tag.set(['viz', 'reference_line', 'color'], refLine.color);
    }
    if (refLine.style) {
      tag = tag.set(['viz', 'reference_line', 'style'], refLine.style);
    }
  }

  // Add legend settings
  if (settings.legend) {
    if (settings.legend.hide) {
      tag = tag.set(['viz', 'legend', 'hide'], null);
    }
    if (settings.legend.position) {
      tag = tag.set(['viz', 'legend', 'position'], settings.legend.position);
    }
  }

  return tag;
}
