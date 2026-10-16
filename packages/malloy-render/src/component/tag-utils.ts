/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Tag} from '@malloydata/malloy-tag';

// Legacy chart tags that need to be converted
const LEGACY_CHART_TAGS = ['bar_chart', 'line_chart', 'combo_chart'];

// Valid viz values that map to charts
export const VIZ_CHART_TYPES = ['bar', 'line', 'combo'];

// Every tag that picks how a whole field is drawn, mapped to the `viz` value
// that picks the same thing.
const VIZ_SELECTING_TAGS: Record<string, string> = {
  'bar_chart': 'bar',
  'line_chart': 'line',
  'combo_chart': 'combo',
  'big_value': 'big_value',
  'scatter_chart': 'scatter',
  'shape_map': 'shape_map',
  'segment_map': 'segment_map',
};

// Valid viz values drawn by a built-in plugin, mapped to that plugin's name
export const VIZ_PLUGIN_TYPES: Record<string, string> = {
  'big_value': 'big_value',
  'scatter': 'scatter_chart',
  'shape_map': 'shape_map',
  'segment_map': 'segment_map',
};

function isVizSelectingTag(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(VIZ_SELECTING_TAGS, name);
}

/**
 * Resolve which visualization a tag asks for, as a `viz` value.
 *
 * One rule: an explicit `viz` wins over every chart tag. Without `viz`, the
 * last-declared chart tag wins.
 *
 * `lineTags` are the field's annotation lines parsed one at a time, in
 * declaration order (inherited lines first, the field's own lines last).
 * They are needed because the merged `tag` keeps a re-declared key in its
 * first position: after `# bar_chart`, `# big_value`, `# bar_chart` its keys
 * are still [bar_chart, big_value]. Without them, key order is used.
 */
export function resolveVizType(
  tag: Tag,
  lineTags: Tag[] = [tag]
): string | undefined {
  if (tag.has('viz')) {
    return tag.text('viz');
  }
  const declared: string[] = [];
  for (const lineTag of lineTags) {
    const properties = lineTag.properties ?? {};
    for (const name of Object.keys(properties).filter(isVizSelectingTag)) {
      // A line that sets (or removes) a chart tag moves it to the end.
      const at = declared.indexOf(name);
      if (at >= 0) declared.splice(at, 1);
      if (!properties[name].deleted) declared.push(name);
    }
  }
  const lastChartTag = declared.at(-1);
  return lastChartTag ? VIZ_SELECTING_TAGS[lastChartTag] : undefined;
}

/** A field, or anything else that carries a tag and its resolved viz type. */
interface VizTagged {
  tag: Tag;
  vizType(): string | undefined;
}

/**
 * The field's tag with its winning legacy chart tag copied into `viz`.
 * A `tagOverride` (a whole replacement tag) is resolved on its own.
 */
export function normalizedVizTag(field: VizTagged, tagOverride?: Tag): Tag {
  return tagOverride
    ? convertLegacyToVizTag(tagOverride)
    : convertLegacyToVizTag(field.tag, field.vizType());
}

/**
 * Convert legacy chart tag names to viz format
 */
function legacyTagToVizType(legacyTag: string): string {
  const legacyMap: Record<string, string> = {
    'bar_chart': 'bar',
    'line_chart': 'line',
    'combo_chart': 'combo',
    'table': 'table',
    'dashboard': 'dashboard',
  };
  // Only convert known legacy tags; unknown ones are returned verbatim
  return legacyMap[legacyTag] ?? legacyTag;
}

/**
 * Convert legacy chart tags to viz format internally. Pass `vizType` when it
 * was resolved from the field's annotation lines; prefer normalizedVizTag.
 */
export function convertLegacyToVizTag(
  tag: Tag,
  vizType = resolveVizType(tag)
): Tag {
  // If viz already exists, return as-is (viz takes precedence)
  if (tag.has('viz')) {
    return tag;
  }

  // Only the winning chart tag converts: a later # big_value (say) must not
  // let an earlier # bar_chart turn into viz=bar.
  const legacyChartTag = LEGACY_CHART_TAGS.find(
    name => VIZ_SELECTING_TAGS[name] === vizType
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
