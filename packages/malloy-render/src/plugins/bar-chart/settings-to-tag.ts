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

  if (settings.size) {
    if (typeof settings.size === 'object') {
      tag.set(['viz', 'size', 'width'], settings.size.width);
      tag.set(['viz', 'size', 'height'], settings.size.height);
    } else {
      tag.set(['viz', 'size'], settings.size);
    }
  }

  return tag;
}
