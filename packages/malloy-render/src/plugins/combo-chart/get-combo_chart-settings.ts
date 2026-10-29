/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {XChannel} from '@/component/types';
import type {Field, NestField} from '@/data_tree';
import {walkFields} from '@/util';
import {convertLegacyToVizTag} from '@/component/tag-utils';
import {
  COMBO_MARK_TYPES,
  defaultComboChartSettings,
  type ComboChartSettings,
  type ComboMarkType,
  type ComboYChannel,
} from './combo-chart-settings';

export type {ComboChartSettings};

// Parse a `<channel>.chart` value, falling back to the default when the value is
// missing or not one of the supported mark types (an invalid value must not
// silently drive behavior).
function parseMarkType(
  value: string | undefined,
  fallback: ComboMarkType
): ComboMarkType {
  return (COMBO_MARK_TYPES as readonly string[]).includes(value ?? '')
    ? (value as ComboMarkType)
    : fallback;
}

export function getComboChartSettings(
  explore: NestField,
  tagOverride?: Tag
): ComboChartSettings {
  const normalizedTag = convertLegacyToVizTag(tagOverride ?? explore.tag);

  if (normalizedTag.text('viz') !== 'combo') {
    throw new Error(
      'Malloy Combo Chart: Tried to render a combo chart, but no viz=combo tag was found'
    );
  }

  const vizTag = normalizedTag.tag('viz')!;

  // if tooltip, disable interactions, otherwise use default
  const interactive = normalizedTag.has('tooltip')
    ? false
    : defaultComboChartSettings.interactive;

  // X-axis independence
  let xIndependent: boolean | 'auto' =
    defaultComboChartSettings.xChannel.independent;
  if (vizTag.has('x', 'independent')) {
    const value = vizTag.text('x', 'independent');
    xIndependent = value === 'false' ? false : true;
  }

  // Per-axis domain independence across chart rows
  const parseYIndependent = (channel: 'y' | 'y2'): boolean => {
    if (vizTag.has(channel, 'independent')) {
      return vizTag.text(channel, 'independent') !== 'false';
    }
    return defaultComboChartSettings.yChannel.independent;
  };

  // Per-axis line styling (only meaningful when the channel draws a line).
  // `line_width` is a stroke width in px; `points` forces dot visibility
  // (`points=false` hides, `points`/`points=true` shows), unset = auto.
  const parseLineStyle = (
    channel: 'y' | 'y2'
  ): {lineWidth?: number; showPoints?: boolean} => {
    const lineWidth = vizTag.numeric(channel, 'line_width');
    const showPoints = vizTag.has(channel, 'points')
      ? vizTag.text(channel, 'points') !== 'false'
      : undefined;
    return {
      ...(lineWidth !== undefined && {lineWidth}),
      ...(showPoints !== undefined && {showPoints}),
    };
  };

  // Explicit axis domain bounds (`y.min`/`y.max`/`y2.min`/`y2.max`). Either end
  // may be pinned on its own.
  const parseAxisBounds = (
    channel: 'y' | 'y2'
  ): {min?: number; max?: number} => {
    const min = vizTag.numeric(channel, 'min');
    const max = vizTag.numeric(channel, 'max');
    return {
      ...(min !== undefined && {min}),
      ...(max !== undefined && {max}),
    };
  };

  // X-axis limit
  const xLimit: number | 'auto' =
    vizTag.numeric('x', 'limit') ?? defaultComboChartSettings.xChannel.limit;

  // Axis-to-mark color tinting is on by default; `color_axes=false` opts out.
  const colorAxes = vizTag.has('color_axes')
    ? vizTag.text('color_axes') !== 'false'
    : defaultComboChartSettings.colorAxes;

  const disableEmbedded =
    vizTag.has('disable_embedded') || defaultComboChartSettings.disableEmbedded;

  const xChannel: XChannel = {
    fields: [],
    type: defaultComboChartSettings.xChannel.type,
    independent: xIndependent,
    limit: xLimit,
  };

  const yChannel: ComboYChannel = {
    fields: [],
    type: defaultComboChartSettings.yChannel.type,
    independent: parseYIndependent('y'),
    chart: parseMarkType(
      vizTag.text('y', 'chart'),
      defaultComboChartSettings.yChannel.chart
    ),
    ...parseLineStyle('y'),
    ...parseAxisBounds('y'),
  };

  const y2Channel: ComboYChannel = {
    fields: [],
    type: defaultComboChartSettings.y2Channel.type,
    independent: parseYIndependent('y2'),
    chart: parseMarkType(
      vizTag.text('y2', 'chart'),
      defaultComboChartSettings.y2Channel.chart
    ),
    ...parseLineStyle('y2'),
    ...parseAxisBounds('y2'),
  };

  // Returns undefined for unknown field refs instead of throwing so bad
  // references are silently skipped here and reported by
  // RenderFieldMetadata.validateFieldTags() with a source location.
  function getField(ref: string): string | undefined {
    try {
      return explore.pathTo(explore.fieldAt([ref]));
    } catch {
      return undefined;
    }
  }

  // Push a numeric (measure or explicitly-tagged numeric) y/y2 field. Non-numeric
  // refs are skipped here and logged as validation errors in
  // RenderFieldMetadata.validateFieldTags() so the user gets a source-located
  // error instead of the red-box tile.
  const pushNumericY = (channel: ComboYChannel, ref: string) => {
    const fieldPath = getField(ref);
    if (fieldPath === undefined) return;
    const field = explore.fieldAt(fieldPath);
    if (field.isNumber() || field.wasCalculation()) {
      channel.fields.push(fieldPath);
    }
  };

  const parseChannelRefs = (channel: ComboYChannel, name: 'y' | 'y2') => {
    if (vizTag.text(name)) {
      pushNumericY(channel, vizTag.text(name)!);
    } else if (vizTag.textArray(name)) {
      vizTag.textArray(name)!.forEach(ref => pushNumericY(channel, ref));
    }
  };

  // Parse top-level x / y / y2 refs
  if (vizTag.text('x')) {
    const xPath = getField(vizTag.text('x')!);
    if (xPath !== undefined) xChannel.fields.push(xPath);
  }
  parseChannelRefs(yChannel, 'y');
  parseChannelRefs(y2Channel, 'y2');

  // Parse embedded field-level tags (# x, # y, # y2)
  if (!disableEmbedded) {
    const embeddedX: string[] = [];
    const embeddedY: string[] = [];
    const embeddedY2: string[] = [];
    walkFields(explore, field => {
      const tag = field.tag;
      const pathTo = explore.pathTo(field);
      if (tag.has('x')) embeddedX.push(pathTo);
      if (tag.has('y') && (field.isNumber() || field.wasCalculation())) {
        embeddedY.push(pathTo);
      }
      if (tag.has('y2') && (field.isNumber() || field.wasCalculation())) {
        embeddedY2.push(pathTo);
      }
    });
    embeddedX.forEach(path => xChannel.fields.push(path));
    embeddedY.forEach(path => yChannel.fields.push(path));
    embeddedY2.forEach(path => y2Channel.fields.push(path));
  }

  const dimensions = explore.fields.filter(
    f => f.isBasic() && f.wasDimension()
  );
  const measures = explore.fields.filter(
    f => f.wasCalculation() && f.isNumber()
  );

  // Auto-pick x if none specified: a time dimension first, else the first
  // dimension not already claimed by a y/y2 channel.
  if (xChannel.fields.length === 0) {
    const isClaimed = (f: Field): boolean => {
      const path = explore.pathTo(f);
      if (yChannel.fields.includes(path)) return true;
      if (y2Channel.fields.includes(path)) return true;
      if (f.tag.has('y') || f.tag.has('y2')) return true;
      return false;
    };
    let fieldToUse: Field | undefined = explore.fields.find(
      f => f.wasDimension() && f.isTime() && !isClaimed(f)
    );
    if (!fieldToUse) fieldToUse = dimensions.find(f => !isClaimed(f));
    if (fieldToUse) xChannel.fields.push(explore.pathTo(fieldToUse));
  }

  // Smart defaults for the two measure axes: the first unclaimed measure goes
  // to the left (y) axis, the second to the right (y2) axis. This makes the
  // common two-measure case work with just `# combo_chart`.
  const isMeasureClaimed = (f: Field): boolean => {
    const path = explore.pathTo(f);
    return yChannel.fields.includes(path) || y2Channel.fields.includes(path);
  };
  // Remember whether each axis was assigned by the user vs. auto-picked here, so
  // we can tell a deliberate two-measure selection from a guess that dropped
  // extras (validated below).
  const yWasImplicit = yChannel.fields.length === 0;
  const y2WasImplicit = y2Channel.fields.length === 0;
  if (yChannel.fields.length === 0) {
    const first = measures.find(f => !isMeasureClaimed(f));
    if (first) yChannel.fields.push(explore.pathTo(first));
  }
  if (y2Channel.fields.length === 0) {
    const second = measures.find(f => !isMeasureClaimed(f));
    if (second) y2Channel.fields.push(explore.pathTo(second));
  }

  // Dedupe field paths. A measure can arrive on the same channel from more than
  // one source (e.g. `y=reach` plus a `# y` tag on `reach`), which would draw a
  // duplicate series + legend entry. Collapse each channel, and drop from y2 any
  // measure already on y (left axis wins) so a measure never appears on both.
  // Done before validation so a channel that dedupes to empty still errors.
  xChannel.fields = [...new Set(xChannel.fields)];
  yChannel.fields = [...new Set(yChannel.fields)];
  y2Channel.fields = [...new Set(y2Channel.fields)].filter(
    p => !yChannel.fields.includes(p)
  );

  // Validation. A combo chart is defined by two independently-scaled measure
  // axes, so it must have an x dimension and at least one measure on each axis.
  // These throw (→ red tile) per docs/validation.md: the user asked for a combo
  // and one cannot be formed.
  if (xChannel.fields.length === 0) {
    throw new Error('Malloy Combo Chart: requires a dimension for the x axis.');
  }
  if (yChannel.fields.length === 0 || y2Channel.fields.length === 0) {
    throw new Error(
      'Malloy Combo Chart: needs at least two measures — one for the left ' +
        'axis (y) and one for the right axis (y2). Provide a second measure, ' +
        'or use # bar_chart / # line_chart for a single-axis chart.'
    );
  }
  // A combo chart plots exactly two measures (one per axis). If we had to guess
  // an axis assignment and measures were left unplotted, a different guess was
  // possible — the choice is ambiguous, so make the user disambiguate rather
  // than silently dropping data. Mirrors the bar chart's "too many dimensions"
  // rule. Skipped when both axes were assigned explicitly (leftovers are then
  // an intentional selection).
  const plotted = new Set([...yChannel.fields, ...y2Channel.fields]);
  const unplotted = measures.filter(m => !plotted.has(explore.pathTo(m)));
  if ((yWasImplicit || y2WasImplicit) && unplotted.length > 0) {
    throw new Error(
      `Malloy Combo Chart: ${measures.length} measures found, but a combo ` +
        'chart plots only two — one on the left axis (y) and one on the right ' +
        '(y2). Assign them explicitly, e.g. # combo_chart { y=measure_a ' +
        'y2=measure_b }.'
    );
  }

  return {
    xChannel,
    yChannel,
    y2Channel,
    interactive,
    colorAxes,
    disableEmbedded,
  };
}
