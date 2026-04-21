/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {Channel, YChannel, SeriesChannel} from '@/component/types';
import type {Field, NestField} from '@/data_tree';
import {walkFields, deepMerge} from '@/util';
import {convertLegacyToVizTag} from '@/component/tag-utils';
import {
  defaultLineChartSettings,
  type LineChartSettings,
  type LineChartPluginOptions,
} from './line-chart-settings';

export type {LineChartSettings, LineChartPluginOptions};

function parseModelDefaults(modelTag?: Tag): Partial<LineChartSettings> {
  const modelDefaults: Partial<LineChartSettings> = {};

  if (!modelTag) {
    return modelDefaults;
  }

  // Parse viz.line_chart.defaults.* tags from the model tag
  // These come from ##r viz.line_chart.defaults.y.independent=true style annotations

  // Check for viz.line_chart.defaults.y.independent
  if (modelTag.has('viz', 'line_chart', 'defaults', 'y', 'independent')) {
    const value = modelTag.text(
      'viz',
      'line_chart',
      'defaults',
      'y',
      'independent'
    );
    if (!modelDefaults.yChannel) modelDefaults.yChannel = {} as YChannel;
    modelDefaults.yChannel.independent = value === 'false' ? false : true;
  }

  // Check for viz.line_chart.defaults.zeroBaseline
  if (modelTag.has('viz', 'line_chart', 'defaults', 'zeroBaseline')) {
    const value = modelTag.text(
      'viz',
      'line_chart',
      'defaults',
      'zeroBaseline'
    );
    modelDefaults.zeroBaseline = value === 'false' ? false : true;
  }

  // Check for viz.line_chart.defaults.x.independent
  if (modelTag.has('viz', 'line_chart', 'defaults', 'x', 'independent')) {
    const value = modelTag.text(
      'viz',
      'line_chart',
      'defaults',
      'x',
      'independent'
    );
    if (!modelDefaults.xChannel) modelDefaults.xChannel = {} as Channel;
    modelDefaults.xChannel.independent = value === 'false' ? false : true;
  }

  // Check for viz.line_chart.defaults.seriesChannel.limit
  if (modelTag.has('viz', 'line_chart', 'defaults', 'seriesChannel', 'limit')) {
    const value = modelTag.numeric(
      'viz',
      'line_chart',
      'defaults',
      'seriesChannel',
      'limit'
    );
    if (value !== null) {
      if (!modelDefaults.seriesChannel)
        modelDefaults.seriesChannel = {} as SeriesChannel;
      modelDefaults.seriesChannel.limit = value as number | 'auto';
    }
  }
  return modelDefaults;
}

export function getLineChartSettings(
  explore: NestField,
  tagOverride?: Tag,
  jsDefaults?: Partial<LineChartSettings>,
  modelTag?: Tag
): LineChartSettings {
  const normalizedTag = convertLegacyToVizTag(tagOverride ?? explore.tag);

  if (normalizedTag.text('viz') !== 'line') {
    throw new Error(
      'Malloy Line Chart: Tried to render a line chart, but no viz=line tag was found'
    );
  }

  const vizTag = normalizedTag.tag('viz')!;

  // Check if this is a spark-sized chart
  const isSpark =
    vizTag.text('size') === 'spark' || normalizedTag.text('size') === 'spark';

  // Parse model defaults from viz.line_chart.defaults.* tags
  const modelDefaults = parseModelDefaults(modelTag);

  // Merge defaults: hardcoded < JS defaults < model defaults
  let mergedDefaults = {...defaultLineChartSettings};
  if (jsDefaults) {
    mergedDefaults = deepMerge(mergedDefaults, jsDefaults);
  }
  if (Object.keys(modelDefaults).length > 0) {
    mergedDefaults = deepMerge(mergedDefaults, modelDefaults);
  }

  // default zero_baseline
  // Sparklines default to false (auto-scale to data range) since they have no visible y-axis
  let zeroBaseline = isSpark ? false : mergedDefaults.zeroBaseline;
  if (vizTag.has('zero_baseline')) {
    const value = vizTag.text('zero_baseline');
    // If explicitly set to false, set to false
    if (value === 'false') {
      zeroBaseline = false;
    }
    // If explicitly set to true or no value, set to true
    else if (
      value === 'true' ||
      value === null ||
      value === undefined ||
      value === ''
    ) {
      zeroBaseline = true;
    }
  }

  // if tooltip, disable interactions, otherwise use default
  const interactive = normalizedTag.has('tooltip')
    ? false
    : mergedDefaults.interactive;

  // X-axis independence
  let xIndependent: boolean | 'auto' = mergedDefaults.xChannel.independent;
  if (vizTag.has('x', 'independent')) {
    const value = vizTag.text('x', 'independent');
    xIndependent = value === 'false' ? false : true;
  }

  // Y-axis independence
  let yIndependent: boolean = mergedDefaults.yChannel.independent;
  if (vizTag.has('y', 'independent')) {
    const value = vizTag.text('y', 'independent');
    yIndependent = value === 'false' ? false : true;
  }

  // Series independence
  let seriesIndependent: boolean | 'auto' =
    mergedDefaults.seriesChannel.independent;
  if (vizTag.has('series', 'independent')) {
    const value = vizTag.text('series', 'independent');
    seriesIndependent = value === 'false' ? false : true;
  }

  // Series limit
  const seriesLimit: number | 'auto' =
    vizTag.numeric('series', 'limit') ?? mergedDefaults.seriesChannel.limit;

  // Disable embedded field tags
  const disableEmbedded =
    vizTag.has('disableEmbedded') || mergedDefaults.disableEmbedded;

  // Chart mode
  const mode: 'yoy' | 'normal' =
    (vizTag.text('mode') as 'yoy' | 'normal') ?? defaultLineChartSettings.mode;

  const xChannel: Channel = {
    fields: [],
    type: mergedDefaults.xChannel.type,
    independent: xIndependent,
  };

  const yChannel: YChannel = {
    fields: [],
    type: mergedDefaults.yChannel.type,
    independent: yIndependent,
  };

  const seriesChannel: SeriesChannel = {
    fields: [],
    type: mergedDefaults.seriesChannel.type,
    independent: seriesIndependent,
    limit: seriesLimit,
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

  // Parse top level tags
  if (vizTag.text('x')) {
    const xPath = getField(vizTag.text('x')!);
    if (xPath !== undefined) xChannel.fields.push(xPath);
  }
  // Non-numeric y fields are skipped here and logged as validation errors
  // in RenderFieldMetadata.validateFieldTags() so the user gets a
  // source-located error instead of the red-box tile.
  const isValidYField = (path: string) => {
    const f = explore.fieldAt(path);
    return f.isNumber() || f.wasCalculation();
  };
  if (vizTag.text('y')) {
    const path = getField(vizTag.text('y')!);
    if (path !== undefined && isValidYField(path)) yChannel.fields.push(path);
  } else if (vizTag.textArray('y')) {
    vizTag.textArray('y')!.forEach(ref => {
      const path = getField(ref);
      if (path !== undefined && isValidYField(path)) yChannel.fields.push(path);
    });
  }
  if (vizTag.text('series')) {
    const seriesPath = getField(vizTag.text('series')!);
    if (seriesPath !== undefined) seriesChannel.fields.push(seriesPath);
  }

  // Parse embedded tags
  const embeddedX: string[] = [];
  const embeddedY: string[] = [];
  const embeddedSeries: string[] = [];

  // Only parse embedded tags if disableEmbedded is not set
  if (!disableEmbedded) {
    walkFields(explore, field => {
      const tag = field.tag;
      const pathTo = explore.pathTo(field);
      if (tag.has('x')) {
        embeddedX.push(pathTo);
      }
      if (tag.has('y')) {
        // Non-numeric y fields skipped here; logged in validateFieldTags.
        if (field.isNumber() || field.wasCalculation()) {
          embeddedY.push(pathTo);
        }
      }
      if (tag.has('series')) {
        embeddedSeries.push(pathTo);
      }
    });

    // Add all x's found
    embeddedX.forEach(path => {
      xChannel.fields.push(path);
    });

    // Add all y's found
    embeddedY.forEach(path => {
      yChannel.fields.push(path);
    });

    // Add all series found
    embeddedSeries.forEach(path => {
      seriesChannel.fields.push(path);
    });
  }

  const dimensions = explore.fields.filter(
    f => f.isBasic() && f.wasDimension()
  );

  // If still no x, attempt to pick the best choice — skipping any field
  // the user has already claimed for another channel either by # y / # series
  // tag or by viz.y / viz.series reference.
  if (xChannel.fields.length === 0) {
    const isClaimed = (f: Field): boolean => {
      const path = explore.pathTo(f);
      if (yChannel.fields.includes(path)) return true;
      if (seriesChannel.fields.includes(path)) return true;
      if (f.tag.has('y') || f.tag.has('series')) return true;
      return false;
    };
    let fieldToUse = explore.fields.find(
      f => f.wasDimension() && f.isTime() && !isClaimed(f)
    );
    if (!fieldToUse) {
      fieldToUse = dimensions.find(f => !isClaimed(f));
    }
    if (fieldToUse) {
      xChannel.fields.push(explore.pathTo(fieldToUse));
    }
  }
  if (yChannel.fields.length === 0) {
    // Pick first numeric measure field
    const numberField = explore.fields.find(
      f => f.wasCalculation() && f.isNumber()
    );
    if (numberField) yChannel.fields.push(explore.pathTo(numberField));
  }
  // If no series defined and multiple dimensions, use leftover dimension
  // (one not already assigned to x or y channels)
  if (seriesChannel.fields.length === 0 && dimensions.length > 1) {
    const dimension = dimensions.find(d => {
      const path = explore.pathTo(d);
      return !xChannel.fields.includes(path) && !yChannel.fields.includes(path);
    });
    if (dimension) {
      seriesChannel.fields.push(explore.pathTo(dimension));
    }
  }

  // Dimensions explicitly assigned to the y channel don't count against the
  // x+series dimension budget.
  const yDimensionsCount = yChannel.fields.filter(path => {
    const field = explore.fieldAt(path);
    return field.wasDimension();
  }).length;

  if (dimensions.length - yDimensionsCount > 2) {
    throw new Error(
      'Malloy Line Chart: Too many dimensions. A line chart can have at most 2 dimensions: 1 for the x axis, and 1 for the series.'
    );
  }
  if (dimensions.length - yDimensionsCount === 0) {
    throw new Error(
      'Malloy Line Chart: No dimensions found. A line chart must have at least 1 dimension for the x axis.'
    );
  }
  if (yChannel.fields.length === 0) {
    throw new Error(
      'Malloy Line Chart: No measures found and no y channel specified. A line chart must have at least 1 measure or explicitly tagged numeric dimension for the y axis.'
    );
  }

  // Validate year-over-year mode requirements
  if (mode === 'yoy') {
    // Must have exactly one x field
    if (xChannel.fields.length !== 1) {
      throw new Error(
        'Malloy Line Chart: Year-over-year mode requires exactly one x-axis field.'
      );
    }

    // Must have exactly one y field
    if (yChannel.fields.length !== 1) {
      throw new Error(
        'Malloy Line Chart: Year-over-year mode requires exactly one y-axis field.'
      );
    }

    // Must not have an explicit series field
    if (seriesChannel.fields.length > 0) {
      throw new Error(
        'Malloy Line Chart: Year-over-year mode cannot be used with an explicit series field.'
      );
    }

    // X field must be temporal
    const xField = explore.fieldAt(xChannel.fields[0]);
    if (!xField.isTime()) {
      throw new Error(
        'Malloy Line Chart: Year-over-year mode requires the x-axis field to be temporal (date/time).'
      );
    }

    // Check if temporal field has appropriate granularity (less than year)
    // This is a heuristic - we check if the timeframe includes more granular components
    const timeframe = xField.isTime() ? xField.timeframe : undefined;
    if (
      timeframe &&
      (timeframe === 'year' ||
        (timeframe.includes('year') &&
          !timeframe.includes('quarter') &&
          !timeframe.includes('month') &&
          !timeframe.includes('week') &&
          !timeframe.includes('day')))
    ) {
      throw new Error(
        'Malloy Line Chart: Year-over-year mode requires temporal data with granularity finer than year (e.g., dates, months, quarters, weeks).'
      );
    }
  }

  const result = {
    xChannel,
    yChannel,
    seriesChannel,
    zeroBaseline,
    interactive,
    disableEmbedded,
    mode,
  };

  return result;
}
