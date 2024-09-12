import {Explore, Tag} from '@malloydata/malloy';
import {BarChartSettings} from './get-bar_chart-settings';
import {RenderResultMetadata, VegaChartProps, VegaSpec} from '../types';
import {getChartSettings} from '../chart-settings';
import {getFieldFromRootPath} from '../plot/util';

const LEGEND_PERC = 0.4;
const LEGEND_MAX = 384;

export function generateBarChartVegaLiteSpec(
  explore: Explore,
  settings: BarChartSettings,
  metadata: RenderResultMetadata,
  chartTag: Tag
): VegaChartProps {
  const xFieldPath = settings.xChannel.fields.at(0);
  const yFieldPath = settings.yChannel.fields.at(0);
  const seriesFieldPath = settings.seriesChannel.fields.at(0);

  if (!xFieldPath) throw new Error('Malloy Bar Chart: Missing x field');
  if (!yFieldPath) throw new Error('Malloy Bar Chart: Missing y field');

  const xField = getFieldFromRootPath(explore, xFieldPath);
  const yField = getFieldFromRootPath(explore, yFieldPath);
  const seriesField = seriesFieldPath
    ? getFieldFromRootPath(explore, seriesFieldPath)
    : null;

  const chartSettings = getChartSettings(explore, metadata, chartTag, {
    xField,
    yField,
  });

  const spec: VegaSpec = {
    '$schema': 'https://vega.github.io/schema/vega-lite/v5.json',
    'width': chartSettings.plotWidth,
    'height': chartSettings.plotHeight,
    'autosize': {
      type: 'none',
      resize: true,
      contains: 'content',
    },
    'padding': chartSettings.padding,
    'data': {'values': []},
    'mark': {'type': 'bar'},
    'encoding': {
      'x': {
        'field': xFieldPath,
        'type': 'ordinal',
        'axis': {
          ...chartSettings.xAxis,
          labelLimit: chartSettings.xAxis.labelSize,
        },
      },
      'y': {
        'field': yFieldPath,
        'type': 'quantitative',
        'axis': chartSettings.yAxis.hidden
          ? null
          : {
              ...chartSettings.yAxis,
              labelLimit: chartSettings.yAxis.width + 10,
            },
        'scale': chartSettings.yScale,
      },
      'color': {
        'scale': {'range': 'category'},
      },
    },
  };

  const needsLegend = seriesField || settings.yChannel.fields.length > 1;
  // TODO: No legend for sparks
  let maxCharCt = 0;
  if (needsLegend) {
    if (seriesField) {
      const meta = metadata.field(seriesField);
      maxCharCt = meta.maxString?.length ?? 0;
      maxCharCt = Math.max(maxCharCt, seriesField.name.length);
    } else {
      maxCharCt = settings.yChannel.fields.reduce(
        (max, f) => Math.max(max, f.length),
        maxCharCt
      );
    }
  }
  const legendSize = Math.min(
    LEGEND_MAX,
    chartSettings.totalWidth * LEGEND_PERC,
    maxCharCt * 10 + 20
  );
  const legendSettings = () => ({
    titleLimit: legendSize - 20,
    labelLimit: legendSize - 40,
  });

  if (needsLegend) spec.padding.right = legendSize;

  // todo: properly calculate max value for stacks
  // will also need this to determine padding
  if (settings.isStack) {
    spec.encoding.y.scale.domain = null;
  }

  // Field driven series
  if (seriesField) {
    spec.encoding.color.field = seriesFieldPath;
    spec.encoding.color.legend = legendSettings();
  } else {
    spec.encoding.color.datum = '';
  }
  if (!settings.isStack && seriesField) {
    spec.encoding.xOffset = {field: seriesFieldPath};
  }

  // Measure list series
  if (settings.yChannel.fields.length > 1) {
    spec.repeat = {'layer': [...settings.yChannel.fields]};
    spec.spec = {
      mark: spec.mark,
      encoding: spec.encoding,
    };
    spec.mark = undefined;
    spec.encoding = undefined;
    spec.spec.encoding.y.field = {'repeat': 'layer'};
    spec.spec.encoding.color = {
      'datum': {'repeat': 'layer'},
      'title': '',
      'legend': legendSettings(),
    };
    if (!settings.isStack)
      spec.spec.encoding.xOffset = {'datum': {'repeat': 'layer'}};
  }

  return {
    spec,
    specType: 'vega-lite',
    plotWidth: chartSettings.plotWidth,
    plotHeight: chartSettings.plotHeight,
    totalWidth: chartSettings.totalWidth,
    totalHeight: chartSettings.totalHeight,
    chartType: 'bar_chart',
  };
}
