/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {Channel} from '../types';
import type {RepeatedRecordField} from '../../data_tree';
import {walkFields} from '../../util';
import {convertLegacyToVizTag} from '../tag-utils';

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
  const normalizedTag = convertLegacyToVizTag(tagOverride ?? explore.tag);

  if (normalizedTag.text('viz') !== 'bar') {
    throw new Error(
      'Tried to render a bar chart, but no viz=bar tag was found'
    );
  }

  const vizTag = normalizedTag.tag('viz')!;

  // if tooltip, disable interactions
  const interactive = !normalizedTag.has('tooltip');
  const isSpark =
    vizTag.text('size') === 'spark' || normalizedTag.text('size') === 'spark';

  const xChannel: Channel = {
    fields: [],
    type: null,
    independent: 'auto',
  };

  const yChannel: Channel = {
    fields: [],
    type: null,
    independent: 'auto',
  };

  const seriesChannel: Channel = {
    fields: [],
    type: null,
    independent: 'auto',
  };

  function getField(ref: string) {
    return explore.pathTo(explore.fieldAt([ref]));
  }

  const isStack = vizTag.has('stack');

  // Parse top level tags from viz properties
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
  if (!vizTag.has('disableEmbedded')) {
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

  // TODO: types
  xChannel.type = 'nominal';
  yChannel.type = 'quantitative';
  seriesChannel.type = 'nominal';

  if (dimensions.length > 2) {
    throw new Error(
      'Malloy Bar Chart: Too many dimensions. A bar chart can have at most 2 dimensions: 1 for the x axis, and 1 for the series.'
    );
  }
  if (dimensions.length === 0) {
    throw new Error(
      'Malloy Bar Chart: No dimensions found. A bar chart must have at least 1 dimension for the x axis.'
    );
  }
  if (measures.length === 0) {
    throw new Error(
      'Malloy Bar Chart: No measures found. A bar chart must have at least 1 measure for the y axis.'
    );
  }

  return {
    xChannel,
    yChannel,
    seriesChannel,
    isStack,
    interactive,
    hideReferences: isSpark,
  };
}
