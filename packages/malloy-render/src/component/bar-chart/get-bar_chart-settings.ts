/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {Tag} from '@malloydata/malloy-tag';
import {walkFields} from '../plot/util';
import {Channel} from '../types';
import {RepeatedRecordField} from '../render-result-metadata';

export type BarChartSettings = {
  xChannel: Channel;
  yChannel: Channel;
  seriesChannel: Channel;
  isStack: boolean;
  interactive: boolean;
  hideReferences: boolean;
};

export function getBarChartSettings(
  explore: RepeatedRecordField,
  tagOverride?: Tag
): BarChartSettings {
  const tag = tagOverride ?? explore.tag;
  const chart = tag.tag('bar_chart') ?? tag.tag('bar');
  // if tooltip, disable interactions
  const interactive = !tag.has('tooltip');
  const isSpark =
    chart?.text('size') === 'spark' || tag.text('size') === 'spark';
  if (!chart) {
    throw new Error(
      'Tried to render a bar_chart, but no bar_chart tag was found'
    );
  }

  const xChannel: Channel = {
    fields: [],
    type: null,
  };

  const yChannel: Channel = {
    fields: [],
    type: null,
  };

  const seriesChannel: Channel = {
    fields: [],
    type: null,
  };

  const isStack = chart.has('stack');

  // Parse top level tags
  if (chart.text('x')) {
    xChannel.fields.push(chart.text('x')!);
  }
  if (chart.text('y')) {
    yChannel.fields.push(chart.text('y')!);
  } else if (chart.textArray('y')) {
    yChannel.fields.push(...chart.textArray('y')!);
  }
  if (chart.text('series')) {
    seriesChannel.fields.push(chart.text('series')!);
  }

  // Parse embedded tags
  const embeddedX: string[] = [];
  const embeddedY: string[] = [];
  const embeddedSeries: string[] = [];
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

  const nestFields = explore.fields;
  const dimensions = nestFields.filter(f => f.isAtomic() && f.wasDimension());

  // If still no x or y, attempt to pick the best choice
  if (xChannel.fields.length === 0) {
    // Pick first dimension field for x
    if (dimensions.length > 0) {
      xChannel.fields.push(explore.pathTo(dimensions[0]));
    }
  }
  if (yChannel.fields.length === 0) {
    // Pick first numeric measure field
    const numberField = nestFields.find(
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

  // TODO: types
  xChannel.type = 'nominal';
  yChannel.type = 'quantitative';
  seriesChannel.type = 'nominal';

  return {
    xChannel,
    yChannel,
    seriesChannel,
    isStack,
    interactive,
    hideReferences: isSpark,
  };
}
