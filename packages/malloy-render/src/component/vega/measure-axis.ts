import {ChartLayoutSettings} from '../chart-layout-settings';
import {VegaSpec} from '../types';

type MeasureAxisOptions = {
  type: 'x' | 'y';
  title: string;
  tickCount: string | number;
  labelLimit: number;
  fieldPath: string;
  showBrushes?: boolean;
  axisSettings?: Partial<ChartLayoutSettings['yAxis']>;
};

export function createMeasureAxis({
  type,
  title,
  tickCount,
  labelLimit,
  fieldPath,
  showBrushes = true,
  axisSettings = {},
}: MeasureAxisOptions) {
  const axis: VegaSpec = {
    'orient': type === 'y' ? 'left' : 'bottom',
    'scale': type === 'y' ? 'yscale' : 'xscale',
    'title': title,
    ...axisSettings,
    'tickCount': {'signal': `${tickCount}`},
    labelLimit: labelLimit,
    encode: {
      labels: {
        enter: {
          text: {
            signal: `renderMalloyNumber(malloyExplore, '${fieldPath}', datum.value, datum, item)`,
          },
        },
        update: {
          text: {
            signal: `renderMalloyNumber(malloyExplore, '${fieldPath}', datum.value, datum, item)`,
          },
          fillOpacity: [
            ...(showBrushes
              ? [
                  {
                    test: 'brushMeasureIn !== "empty" ? (datum.index !== 0 && datum.index !== 1) : false',
                    value: 0,
                  },
                  {
                    test: 'brushMeasureRangeIn && datum.value >= (brushMeasureRangeIn[0] - (invert("yscale", 0)-invert("yscale", 20))) && datum.value <= (brushMeasureRangeIn[1] + (invert("yscale", 0)-invert("yscale", 20)))',
                    value: 0,
                  },
                ]
              : []),
            {
              value: 1,
            },
          ],
        },
      },
    },
  };

  const axisOverlayMark = createAxisOverlay({type, axisSettings});

  return {
    axis,
    axisOverlayMark,
  };
}

type AxisOverlayOptions =
  | {
      type: 'x';
      axisSettings: Partial<ChartLayoutSettings['xAxis']>;
    }
  | {
      type: 'y';
      axisSettings: Partial<ChartLayoutSettings['yAxis']>;
    };

function createAxisOverlay(options: AxisOverlayOptions) {
  const axisOverlay: VegaSpec = {
    name: `${options.type}_axis_overlay`,
    type: 'rect',
    encode: {
      enter: {},
    },
  };

  if (options.type === 'y') {
    axisOverlay.enter = {
      x: {
        value: -options.axisSettings.width! + options.axisSettings.yTitleSize!,
      },
      x2: {value: 0},
      y: {value: 0},
      y2: {signal: 'height'},
      fill: {value: 'transparent'},
    };
  }

  if (options.type === 'x') {
    axisOverlay.enter = {
      y: {
        signal: `height + ${options.axisSettings.height} + 4`,
      },
      y2: {signal: 'height'},
      x: {value: 0},
      x2: {signal: 'width'},
      fill: {value: 'transparent'},
    };
  }

  return axisOverlay;
}
