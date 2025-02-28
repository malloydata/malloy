/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {Tag} from '@malloydata/malloy-tag';
import {getFieldPathBetweenFields, walkFields} from '../plot/util';
import {Channel, RenderResultMetadata} from '../types';
import {
  getNestFields,
  isAtomic,
  NestFieldInfo,
  tagFor,
  wasCalculation,
  wasDimension,
} from '../util';

export type BarChartSettings = {
  xChannel: Channel;
  yChannel: Channel;
  seriesChannel: Channel;
  isStack: boolean;
  interactive: boolean;
  hideReferences: boolean;
};

export function getBarChartSettings(
  explore: NestFieldInfo,
  metadata: RenderResultMetadata,
  tagOverride?: Tag
): BarChartSettings {
  const tag = tagOverride ?? tagFor(explore);
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
    const tag = tagFor(field);
    if (tag.has('x')) {
      embeddedX.push(getFieldPathBetweenFields(explore, field, metadata));
    }
    if (tag.has('y')) {
      embeddedY.push(getFieldPathBetweenFields(explore, field, metadata));
    }
    if (tag.has('series')) {
      embeddedSeries.push(getFieldPathBetweenFields(explore, field, metadata));
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

  const nestFields = getNestFields(explore);
  const dimensions = nestFields.filter(f => isAtomic(f) && wasDimension(f));

  // If still no x or y, attempt to pick the best choice
  if (xChannel.fields.length === 0) {
    // Pick first dimension field for x
    if (dimensions.length > 0) {
      xChannel.fields.push(
        getFieldPathBetweenFields(explore, dimensions[0], metadata)
      );
    }
  }
  if (yChannel.fields.length === 0) {
    // Pick first numeric measure field
    const numberField = nestFields.find(
      f => isAtomic(f) && wasCalculation(f) && f.type.kind === 'number_type'
    );
    if (numberField)
      yChannel.fields.push(
        getFieldPathBetweenFields(explore, numberField, metadata)
      );
  }
  // If no series defined and multiple dimensions, use leftover dimension
  if (seriesChannel.fields.length === 0 && dimensions.length > 1) {
    const dimension = dimensions.find(d => {
      const path = getFieldPathBetweenFields(explore, d, metadata);
      return !xChannel.fields.includes(path);
    });
    if (dimension) {
      seriesChannel.fields.push(
        getFieldPathBetweenFields(explore, dimension, metadata)
      );
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
