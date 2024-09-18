import {Explore, Tag} from '@malloydata/malloy';
import {Channel} from '../plot/plot-spec';
import {getFieldPathBetweenFields, walkFields} from '../plot/util';

export type AreaChartSettings = {
  xChannel: Channel;
  yChannel: Channel;
  y2Channel: Channel;
  seriesChannel: Channel;
  zeroBaseline: boolean;
  interpolate?: string;
  isDiffChart: boolean;
  isStreamGraph: boolean;
};

export function getAreaChartSettings(
  explore: Explore,
  tagOverride?: Tag
): AreaChartSettings {
  const tag = tagOverride ?? explore.tagParse().tag;
  const chart = tag.tag('area_chart');
  if (!chart) {
    throw new Error(
      'Tried to render a bar_chart, but no bar_chart tag was found'
    );
  }

  const interpolate = chart.text('interpolate');

  const xChannel: Channel = {
    fields: [],
    type: null,
  };

  const yChannel: Channel = {
    fields: [],
    type: null,
  };

  const y2Channel: Channel = {
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
  if (chart.text('y2')) {
    y2Channel.fields.push(chart.text('y2')!);
  }
  if (chart.text('series')) {
    seriesChannel.fields.push(chart.text('series')!);
  }

  // Parse embedded tags
  const embeddedX: string[] = [];
  const embeddedY: string[] = [];
  const embeddedY2: string[] = [];
  const embeddedSeries: string[] = [];
  walkFields(explore, field => {
    const {tag} = field.tagParse();
    if (tag.has('x')) {
      embeddedX.push(getFieldPathBetweenFields(explore, field));
    }
    if (tag.has('y')) {
      embeddedY.push(getFieldPathBetweenFields(explore, field));
    }
    if (tag.has('y2')) {
      embeddedY2.push(getFieldPathBetweenFields(explore, field));
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

  // Add all y2's found
  embeddedY2.forEach(path => {
    y2Channel.fields.push(path);
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

  const isDiffChart = y2Channel.fields.length > 0;
  const zeroBaseline = !(
    isDiffChart && chart.text('zero_baseline') === 'false'
  );

  return {
    xChannel,
    yChannel,
    y2Channel,
    seriesChannel,
    zeroBaseline,
    interpolate,
    isDiffChart,
    isStreamGraph: chart.text('stack') === 'center',
  };
}
