/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Tag} from '@malloydata/malloy-tag';

// Legacy chart tags that need to be converted
const LEGACY_CHART_TAGS = ['bar_chart', 'line_chart'];

// Valid viz values that map to charts
export const VIZ_CHART_TYPES = ['bar', 'line'];

/**
 * Convert legacy chart tag names to viz format
 */
function legacyTagToVizType(legacyTag: string): string {
  const legacyMap: Record<string, string> = {
    'bar_chart': 'bar',
    'line_chart': 'line',
    'table': 'table',
    'dashboard': 'dashboard',
  };
  // Only convert known legacy tags; unknown ones are returned verbatim
  return legacyMap[legacyTag] ?? legacyTag;
}

/**
 * Convert legacy chart tags to viz format internally.
 */
export function convertLegacyToVizTag(tag: Tag): Tag {
  // If viz already exists, return as-is (viz takes precedence)
  if (tag.has('viz')) {
    return tag;
  }

  // Look for legacy chart tags using existing precedence logic
  const properties = tag.properties ?? {};
  const tagNamesInOrder = Object.keys(properties).reverse();

  const legacyChartTag = tagNamesInOrder.find(
    name => LEGACY_CHART_TAGS.includes(name) && !properties[name].deleted
  );

  // Copy legacy tags into viz property
  if (legacyChartTag) {
    const legacyTagObject = tag.tag(legacyChartTag);
    // First set the legacy tag (clones it with correct parent), then set the value
    if (legacyTagObject) {
      return tag
        .set(['viz'], legacyTagObject)
        .set(['viz'], legacyTagToVizType(legacyChartTag));
    }
    return tag.set(['viz'], legacyTagToVizType(legacyChartTag));
  }

  return tag;
}

/**
 * Get the effective chart type from a normalized tag
 */
export function getChartTypeFromNormalizedTag(
  normalizedTag: Tag
): string | undefined {
  const vizType = normalizedTag.text('viz');
  if (vizType && VIZ_CHART_TYPES.includes(vizType)) {
    return vizType;
  }
  return undefined;
}
