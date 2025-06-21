/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {Channel, YChannel, SeriesChannel} from '@/component/types';
import type {NestField} from '@/data_tree';
import {walkFields} from '@/util';
import {convertLegacyToVizTag} from '@/component/tag-utils';
import {
  defaultLineChartSettings,
  type LineChartSettings,
} from './line-chart-settings';

export type {LineChartSettings};

export function getLineChartSettings(
  explore: NestField,
  tagOverride?: Tag
): LineChartSettings {
  const normalizedTag = convertLegacyToVizTag(tagOverride ?? explore.tag);

  if (normalizedTag.text('viz') !== 'line') {
    throw new Error(
      'Malloy Line Chart: Tried to render a line chart, but no viz=line tag was found'
    );
  }

  const vizTag = normalizedTag.tag('viz')!;

  // default zero_baselinse
  let zeroBaseline = defaultLineChartSettings.zeroBaseline;
  if (vizTag.has('zero_baseline')) {
    const value = vizTag.text('zero_baseline');
    // If explicitly set to false, set to false
    if (value === 'false') {
      zeroBaseline = false;
    }
    // If explicilty set to true or no value, set to true
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
    : defaultLineChartSettings.interactive;

  // X-axis independence
  let xIndependent: boolean | 'auto' =
    defaultLineChartSettings.xChannel.independent;
  if (vizTag.has('x', 'independent')) {
    const value = vizTag.text('x', 'independent');
    xIndependent = value === 'false' ? false : true;
  }

  // Y-axis independence
  let yIndependent: boolean = defaultLineChartSettings.yChannel.independent;
  if (vizTag.has('y', 'independent')) {
    const value = vizTag.text('y', 'independent');
    yIndependent = value === 'false' ? false : true;
  }

  // Series independence
  let seriesIndependent: boolean | 'auto' =
    defaultLineChartSettings.seriesChannel.independent;
  if (vizTag.has('series', 'independent')) {
    const value = vizTag.text('series', 'independent');
    seriesIndependent = value === 'false' ? false : true;
  }

  // Series limit
  const seriesLimit: number | 'auto' =
    vizTag.numeric('series', 'limit') ??
    defaultLineChartSettings.seriesChannel.limit;

  // Disable embedded field tags
  const disableEmbedded =
    vizTag.has('disable_embedded') || defaultLineChartSettings.disableEmbedded;

  const xChannel: Channel = {
    fields: [],
    type: defaultLineChartSettings.xChannel.type,
    independent: xIndependent,
  };

  const yChannel: YChannel = {
    fields: [],
    type: defaultLineChartSettings.yChannel.type,
    independent: yIndependent,
  };

  const seriesChannel: SeriesChannel = {
    fields: [],
    type: defaultLineChartSettings.seriesChannel.type,
    independent: seriesIndependent,
    limit: seriesLimit,
  };

  function getField(ref: string) {
    return explore.pathTo(explore.fieldAt([ref]));
  }

  // Parse top level tags
  if (vizTag.text('x')) {
    xChannel.fields.push(getField(vizTag.text('x')!));
  }
  if (vizTag.text('y')) {
    yChannel.fields.push(getField(vizTag.text('y')!));
  } else if (vizTag.textArray('y')) {
    yChannel.fields.push(...vizTag.textArray('y')!.map(getField));
  }
  if (vizTag.text('series')) {
    seriesChannel.fields.push(getField(vizTag.text('series')!));
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
        embeddedY.push(pathTo);
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

  const measures = explore.fields.filter(f => f.wasCalculation());

  // If still no x or y, attempt to pick the best choice
  if (xChannel.fields.length === 0) {
    // Pick date/time field first if it exists
    const dateTimeField = explore.fields.find(
      f => f.wasDimension() && f.isTime()
    );
    if (dateTimeField) xChannel.fields.push(explore.pathTo(dateTimeField));
    // Pick first dimension field for x
    else if (dimensions.length > 0) {
      xChannel.fields.push(explore.pathTo(dimensions[0]));
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
  if (seriesChannel.fields.length === 0 && dimensions.length > 1) {
    const dimension = dimensions.find(d => {
      const path = explore.pathTo(d);
      return !xChannel.fields.includes(path);
    });
    if (dimension) {
      seriesChannel.fields.push(explore.pathTo(dimension));
    }
  }

  if (dimensions.length > 2) {
    throw new Error(
      'Malloy Line Chart: Too many dimensions. A line chart can have at most 2 dimensions: 1 for the x axis, and 1 for the series.'
    );
  }
  if (dimensions.length === 0) {
    throw new Error(
      'Malloy Line Chart: No dimensions found. A line chart must have at least 1 dimension for the x axis.'
    );
  }
  if (measures.length === 0) {
    throw new Error(
      'Malloy Line Chart: No measures found. A line chart must have at least 1 measure for the y axis.'
    );
  }

  return {
    xChannel,
    yChannel,
    seriesChannel,
    zeroBaseline,
    interactive,
    disableEmbedded,
  };
}
