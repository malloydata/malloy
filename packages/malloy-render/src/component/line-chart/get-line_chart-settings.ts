/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {Explore} from '@malloydata/malloy';
import {Tag} from '@malloydata/malloy-tag';
import {getFieldPathBetweenFields, walkFields} from '../plot/util';
import {Channel} from '../types';

export type LineChartSettings = {
  xChannel: Channel;
  yChannel: Channel;
  seriesChannel: Channel;
  zeroBaseline: boolean;
  interactive: boolean;
};

export function getLineChartSettings(
  explore: Explore,
  tagOverride?: Tag
): LineChartSettings {
  const tag = tagOverride ?? explore.tagParse().tag;
  const chart = tag.tag('line_chart');
  if (!chart) {
    throw new Error(
      'Tried to render a bar_chart, but no bar_chart tag was found'
    );
  }

  const zeroBaseline = chart.has('zero_baseline')
    ? chart.text('zero_baseline') !== 'false'
    : true;

  // if tooltip, disable interactions
  const interactive = !tag.has('tooltip');

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
    const {tag} = field.tagParse();
    if (tag.has('x')) {
      embeddedX.push(getFieldPathBetweenFields(explore, field));
    }
    if (tag.has('y')) {
      embeddedY.push(getFieldPathBetweenFields(explore, field));
    }
    if (tag.has('series')) {
      embeddedSeries.push(getFieldPathBetweenFields(explore, field));
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

  const dimensions = explore.allFields.filter(
    f => f.isAtomicField() && f.sourceWasDimension()
  );

  // If still no x or y, attempt to pick the best choice
  if (xChannel.fields.length === 0) {
    // Pick first dimension field for x
    if (dimensions.length > 0) {
      xChannel.fields.push(getFieldPathBetweenFields(explore, dimensions[0]));
    }
  }
  if (yChannel.fields.length === 0) {
    // Pick first numeric measure field
    const numberField = explore.allFields.find(
      f => f.isAtomicField() && f.sourceWasMeasureLike() && f.isNumber()
    );
    if (numberField)
      yChannel.fields.push(getFieldPathBetweenFields(explore, numberField));
  }
  // If no series defined and multiple dimensions, use leftover dimension
  if (seriesChannel.fields.length === 0 && dimensions.length > 1) {
    const dimension = dimensions.find(d => {
      const path = getFieldPathBetweenFields(explore, d);
      return !xChannel.fields.includes(path);
    });
    if (dimension) {
      seriesChannel.fields.push(getFieldPathBetweenFields(explore, dimension));
    }
  }

  // TODO: types. This logic may move into each chart vega spec creation
  xChannel.type = 'nominal';
  yChannel.type = 'quantitative';
  seriesChannel.type = 'nominal';

  return {
    xChannel,
    yChannel,
    seriesChannel,
    zeroBaseline,
    interactive,
  };
}
