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
  return value === 'bar' || value === 'line' ? value : fallback;
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

  const isSpark =
    vizTag.text('size') === 'spark' || normalizedTag.text('size') === 'spark';
  const hideReferences = isSpark;

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

  // X-axis limit
  const xLimit: number | 'auto' =
    vizTag.numeric('x', 'limit') ?? defaultComboChartSettings.xChannel.limit;

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
  };

  const y2Channel: ComboYChannel = {
    fields: [],
    type: defaultComboChartSettings.y2Channel.type,
    independent: parseYIndependent('y2'),
    chart: parseMarkType(
      vizTag.text('y2', 'chart'),
      defaultComboChartSettings.y2Channel.chart
    ),
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
  if (yChannel.fields.length === 0) {
    const first = measures.find(f => !isMeasureClaimed(f));
    if (first) yChannel.fields.push(explore.pathTo(first));
  }
  if (y2Channel.fields.length === 0) {
    const second = measures.find(f => !isMeasureClaimed(f));
    if (second) y2Channel.fields.push(explore.pathTo(second));
  }

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

  return {
    xChannel,
    yChannel,
    y2Channel,
    interactive,
    hideReferences,
    disableEmbedded,
  };
}
