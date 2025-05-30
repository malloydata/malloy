/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {Channel} from '../types';
import type {NestField} from '../../data_tree';
import {walkFields} from '../../util';
import {defaultSettings} from '../default-settings';
import {convertLegacyToVizTag} from '../tag-utils';

export type LineChartSettings = {
  xChannel: Channel;
  yChannel: Channel;
  seriesChannel: Channel;
  zeroBaseline: boolean;
  interactive: boolean;
};

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
  let zeroBaseline = defaultSettings.line_chart.zero_baseline;
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

  // if tooltip, disable interactions
  const interactive = !normalizedTag.has('tooltip');

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

  const dimensions = explore.fields.filter(
    f => f.isBasic() && f.wasDimension()
  );

  const measures = explore.fields.filter(f => f.wasCalculation());

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

  // TODO: types
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
