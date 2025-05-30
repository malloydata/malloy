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
 * This is the key normalization function that makes viz the single source of truth.
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

  if (legacyChartTag) {
    const vizType = legacyTagToVizType(legacyChartTag);
    const legacyTagObject = tag.tag(legacyChartTag);

    // Create new tag with viz property containing the legacy tag's content
    let newTag = tag.set(['viz'], vizType);

    // Copy over any properties from the legacy tag to the viz tag
    // TODO: see if there is a better way to copy tag properties over, it might be as simple as getting full properties and passing them into a Tag function that already exists
    if (legacyTagObject?.properties) {
      Object.entries(legacyTagObject.properties).forEach(
        ([key, tagProperty]) => {
          if (!tagProperty.deleted) {
            // Copy the value at this node (if any)
            const nodeValue = legacyTagObject.text(key);
            if (nodeValue !== undefined) {
              newTag = newTag.set(['viz', key], nodeValue);
            }
            // Recursively copy sub-properties
            const childTag = legacyTagObject.tag(key);
            if (childTag) {
              const copySubtree = (
                src: Tag,
                dest: Tag,
                path: string[]
              ): Tag => {
                for (const [subKey, subProp] of Object.entries(
                  src.properties ?? {}
                )) {
                  if (subProp.deleted) continue;
                  const val = src.text(subKey);
                  if (val !== undefined) {
                    dest = dest.set([...path, subKey], val);
                  }
                  const deeper = src.tag(subKey);
                  if (deeper) {
                    dest = copySubtree(deeper, dest, [...path, subKey]);
                  }
                }
                return dest;
              };
              newTag = copySubtree(childTag, newTag, ['viz', key]);
            }
          }
        }
      );
    }

    return newTag;
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
    return vizType; // return canonical viz value (bar, line, …)
  }
  return undefined;
}
