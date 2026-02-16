/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {Channel, SeriesChannel, YChannel} from '@/component/types';
import type {Field, NestField} from '@/data_tree';
import {walkFields} from '@/util';
import {convertLegacyToVizTag} from '@/component/tag-utils';
import {
  defaultBarChartSettings,
  type BarChartSettings,
} from './bar-chart-settings';

export type {BarChartSettings};

export function getBarChartSettings(
  explore: NestField,
  tagOverride?: Tag
): BarChartSettings {
  const normalizedTag = convertLegacyToVizTag(tagOverride ?? explore.tag);

  if (normalizedTag.text('viz') !== 'bar') {
    throw new Error(
      'Malloy Bar Chart: Tried to render a bar chart, but no viz=bar tag was found'
    );
  }

  const vizTag = normalizedTag.tag('viz')!;

  // if tooltip, disable interactions, otherwise use default
  const interactive = normalizedTag.has('tooltip')
    ? false
    : defaultBarChartSettings.interactive;

  // Check for spark size to determine hideReferences
  const isSpark =
    vizTag.text('size') === 'spark' || normalizedTag.text('size') === 'spark';
  const hideReferences = isSpark;

  // X-axis independence
  let xIndependent: boolean | 'auto' =
    defaultBarChartSettings.xChannel.independent;
  if (vizTag.has('x', 'independent')) {
    const value = vizTag.text('x', 'independent');
    xIndependent = value === 'false' ? false : true;
  }

  // Y-axis independence
  let yIndependent: boolean = defaultBarChartSettings.yChannel.independent;
  if (vizTag.has('y', 'independent')) {
    const value = vizTag.text('y', 'independent');
    yIndependent = value === 'false' ? false : true;
  }

  // Series independence
  let seriesIndependent: boolean | 'auto' =
    defaultBarChartSettings.seriesChannel.independent;
  if (vizTag.has('series', 'independent')) {
    const value = vizTag.text('series', 'independent');
    seriesIndependent = value === 'false' ? false : true;
  }

  // Series limit
  const seriesLimit: number | 'auto' =
    vizTag.numeric('series', 'limit') ??
    defaultBarChartSettings.seriesChannel.limit;

  // Disable embedded field tags
  const disableEmbedded =
    vizTag.has('disable_embedded') || defaultBarChartSettings.disableEmbedded;

  const xChannel: Channel = {
    fields: [],
    type: defaultBarChartSettings.xChannel.type,
    independent: xIndependent,
  };

  const yChannel: YChannel = {
    fields: [],
    type: defaultBarChartSettings.yChannel.type,
    independent: yIndependent,
  };

  const y2Channel: YChannel = {
    fields: [],
    type: defaultBarChartSettings.yChannel.type,
    independent: false,
  };

  const seriesChannel: SeriesChannel = {
    fields: [],
    type: defaultBarChartSettings.seriesChannel.type,
    independent: seriesIndependent,
    limit: seriesLimit,
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
    const yFieldRef = vizTag.text('y')!;
    const yFieldPath = getField(yFieldRef);
    const yField = explore.fieldAt(yFieldPath);

    // Validate Y field
    if (!yField.isNumber() && !yField.wasCalculation()) {
      throw new Error(
        `Malloy Bar Chart: Field "${yField.name}" is tagged as y but is not numeric. Only numeric fields can be used as y channel.`
      );
    }
    yChannel.fields.push(yFieldPath);
  } else if (vizTag.textArray('y')) {
    const yFieldRefs = vizTag.textArray('y')!;
    yFieldRefs.forEach(ref => {
      const fieldPath = getField(ref);
      const field = explore.fieldAt(fieldPath);

      if (!field.isNumber() && !field.wasCalculation()) {
        throw new Error(
          `Malloy Bar Chart: Field "${field.name}" is tagged as y but is not numeric. Only numeric fields can be used as y channel.`
        );
      }
      yChannel.fields.push(fieldPath);
    });
  }
  // Parse y2 channel from viz tag
  if (vizTag.text('y2')) {
    const y2FieldRef = vizTag.text('y2')!;
    const y2FieldPath = getField(y2FieldRef);
    const y2Field = explore.fieldAt(y2FieldPath);
    if (!y2Field.isNumber() && !y2Field.wasCalculation()) {
      throw new Error(
        `Malloy Bar Chart: Field "${y2Field.name}" is tagged as y2 but is not numeric. Only numeric fields can be used as y2 channel.`
      );
    }
    y2Channel.fields.push(y2FieldPath);
  } else if (vizTag.textArray('y2')) {
    const y2FieldRefs = vizTag.textArray('y2')!;
    y2FieldRefs.forEach(ref => {
      const fieldPath = getField(ref);
      const field = explore.fieldAt(fieldPath);
      if (!field.isNumber() && !field.wasCalculation()) {
        throw new Error(
          `Malloy Bar Chart: Field "${field.name}" is tagged as y2 but is not numeric. Only numeric fields can be used as y2 channel.`
        );
      }
      y2Channel.fields.push(fieldPath);
    });
  }

  if (vizTag.text('series')) {
    seriesChannel.fields.push(getField(vizTag.text('series')!));
  }

  // Parse embedded tags
  const embeddedX: string[] = [];
  const embeddedY: string[] = [];
  const embeddedY2: string[] = [];
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
        // Validate y field
        if (!field.isNumber() && !field.wasCalculation()) {
          throw new Error(
            `Malloy Bar Chart: Field "${field.name}" is tagged as y but is not numeric. Only numeric fields can be used as y channel.`
          );
        }
        embeddedY.push(pathTo);
      }
      if (tag.has('y2')) {
        // Validate y2 field
        if (!field.isNumber() && !field.wasCalculation()) {
          throw new Error(
            `Malloy Bar Chart: Field "${field.name}" is tagged as y2 but is not numeric. Only numeric fields can be used as y2 channel.`
          );
        }
        embeddedY2.push(pathTo);
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

    // Add all y2's found
    embeddedY2.forEach(path => {
      y2Channel.fields.push(path);
    });

    // Add all series found
    embeddedSeries.forEach(path => {
      seriesChannel.fields.push(path);
    });
  }

  const dimensions = explore.fields.filter(
    f => f.isBasic() && f.wasDimension()
  );

  // If still no x or y, attempt to pick the best choice
  if (xChannel.fields.length === 0) {
    let fieldToUse: Field | undefined;
    // Pick date/time field first if it exists
    const dateTimeField = explore.fields.find(
      f => f.wasDimension() && f.isTime()
    );
    if (dateTimeField) fieldToUse = dateTimeField;
    // Pick first dimension field for x
    else if (dimensions.length > 0) {
      fieldToUse = dimensions[0];
    }
    const fieldToUseTags = fieldToUse?.tag;
    const isSeries = fieldToUseTags?.has('series');
    if (fieldToUse && !isSeries) {
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
  if (seriesChannel.fields.length === 0 && dimensions.length > 1) {
    const dimension = dimensions.find(d => {
      const path = explore.pathTo(d);
      return !xChannel.fields.includes(path) && !yChannel.fields.includes(path);
    });
    if (dimension) {
      seriesChannel.fields.push(explore.pathTo(dimension));
    }
  }

  // Validate dimensions with series concatenation logic
  const xDimensionsCount = xChannel.fields.length;
  const seriesDimensionsCount = seriesChannel.fields.length;
  const totalDimensions = dimensions.length;

  // Validation logic:
  // - If 3+ dimensions exist, multiple series fields must be explicitly tagged
  // - Otherwise, follow the standard 2-dimension limit
  if (totalDimensions > xDimensionsCount + seriesDimensionsCount) {
    throw new Error(
      'Malloy Bar Chart: Too many dimensions. A bar chart can have at most 2 dimensions: 1 for the x axis, and 1 for the series. To use 3+ dimensions, explicitly tag multiple fields as series.'
    );
  }

  if (xDimensionsCount > 1) {
    throw new Error(
      'Malloy Bar Chart: A bar chart can have at most 1 dimension for the x axis.'
    );
  }
  if (xDimensionsCount === 0) {
    throw new Error(
      'Malloy Bar Chart: A bar chart requires a dimension for the x axis.'
    );
  }

  // Check if we have at least one Y field (either measure or explicitly tagged numeric dimension)
  if (yChannel.fields.length === 0) {
    throw new Error(
      'Malloy Bar Chart: No measures found and no y channel specified. A bar chart must have at least 1 measure or explicitly tagged numeric dimension for the y axis.'
    );
  }

  // Parse color settings
  const colorScheme = vizTag.text('colorScheme') ?? undefined;
  const colors = vizTag.textArray('colors') ?? undefined;

  // Parse layout
  const layout: 'vertical' | 'horizontal' | undefined =
    vizTag.has('horizontal') || vizTag.text('layout') === 'horizontal'
      ? 'horizontal'
      : undefined;

  // Parse y scale type
  const yScaleTypeRaw = vizTag.text('y', 'scale') as
    | 'linear'
    | 'log'
    | 'symlog'
    | undefined;
  const yScaleType =
    yScaleTypeRaw && ['linear', 'log', 'symlog'].includes(yScaleTypeRaw)
      ? yScaleTypeRaw
      : undefined;

  // Parse reference lines
  const referenceLines: Array<{
    y: number;
    label?: string;
    color?: string;
    style?: 'dashed' | 'solid' | 'dotted';
  }> = [];
  const refLineTag = vizTag.tag('reference_line');
  if (refLineTag) {
    const y = refLineTag.numeric('y');
    if (y !== null && y !== undefined) {
      referenceLines.push({
        y,
        label: refLineTag.text('label') ?? undefined,
        color: refLineTag.text('color') ?? undefined,
        style:
          (refLineTag.text('style') as 'dashed' | 'solid' | 'dotted') ??
          undefined,
      });
    }
  }

  // Parse legend settings
  const legendTag = vizTag.tag('legend');
  const legend = legendTag
    ? {
        position:
          (legendTag.text('position') as 'right' | 'bottom') ?? undefined,
        hide: legendTag.has('hide') || undefined,
      }
    : undefined;

  return {
    xChannel,
    yChannel,
    y2Channel: y2Channel.fields.length > 0 ? y2Channel : undefined,
    seriesChannel,
    isStack,
    interactive,
    hideReferences,
    disableEmbedded,
    colorScheme,
    colors,
    yScaleType,
    layout,
    referenceLines: referenceLines.length > 0 ? referenceLines : undefined,
    legend,
  };
}
