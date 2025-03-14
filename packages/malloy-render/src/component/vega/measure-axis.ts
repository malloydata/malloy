/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Axis, GroupMark, RectMark} from 'vega';
import type {ChartLayoutSettings} from '../chart-layout-settings';
import {grayMedium} from './base-vega-config';

type MeasureAxisOptions = {
  type: 'y';
  title: string;
  tickCount: string | number;
  labelLimit: number;
  fieldPath: string;
  fieldRef: string | undefined;
  brushMeasureRangeSourceId: string;
  showBrushes?: boolean;
  axisSettings: ChartLayoutSettings['yAxis'];
};

export function createMeasureAxis({
  type,
  title,
  tickCount,
  labelLimit,
  fieldPath,
  showBrushes = true,
  axisSettings,
}: MeasureAxisOptions) {
  const axis: Axis = {
    orient: 'left',
    scale: 'yscale',
    title: title,
    ...axisSettings,
    tickCount: {'signal': `${tickCount}`},
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
                    test: 'brushMeasureIn !== null ? (datum.index !== 0 && datum.index !== 1) : false',
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

  const yAxisReferenceLines = createAxisReferenceLines({
    type,
    fieldPath,
    axisSettings,
  });
  const axisOverlayMark = createAxisOverlay({type, axisSettings});
  // TODO: For now, don't do range brushes as there are some issues to work through
  // const yAxisRangeBrush = createAxisRangeBrush({
  //   type,
  //   axisSettings,
  //   fieldPath,
  //   fieldRef,
  //   brushMeasureRangeSourceId,
  // });
  const interactiveMarks = [
    yAxisReferenceLines,
    axisOverlayMark,
    // yAxisRangeBrush.mark,
  ];

  const interactiveSignals = [];
  // TODO: For now, disabling range brushes
  // const interactiveSignals = [...yAxisRangeBrush.signals];

  const brushMeasureEvents = [
    {
      events: '@y_axis_overlay:mousemove',
      update:
        "yIsBrushing ? null : { fieldRefId: measureFieldRefId, sourceId: brushMeasureSourceId, value: event.shiftKey ? invert('yscale',y(item())) : snapValue([domain('yscale')[0],domain('yscale')[1]], 1000,invert('yscale',y(item()))), type: 'measure'}",
    },
    {
      events: '@y_axis_overlay:mouseout',
      update: 'null',
    },
  ];

  return {
    axis,
    interactiveMarks,
    interactiveSignals,
    brushMeasureEvents,
  };
}

type AxisOverlayOptions = {
  type: 'y';
  axisSettings: Partial<ChartLayoutSettings['yAxis']>;
};

function createAxisOverlay(options: AxisOverlayOptions) {
  const axisOverlay: RectMark = {
    name: `${options.type}_axis_overlay`,
    type: 'rect',
    encode: {
      enter: {},
    },
  };

  axisOverlay.encode!.enter = {
    x: {
      value: -options.axisSettings.width! + options.axisSettings.yTitleSize!,
    },
    x2: {value: 0},
    y: {value: 0},
    y2: {signal: 'height'},
    fill: {value: 'transparent'},
  };

  return axisOverlay;
}

type AxisReferenceLineOptions = {
  type: 'y';
  fieldPath: string;
  axisSettings: {
    width: number;
    yTitleSize: number;
  };
};

function createAxisReferenceLines(options: AxisReferenceLineOptions) {
  const opacityRefLineSignal = {
    signal: 'brushMeasureIn === null || yIsBrushing ? 0 : 1',
  };

  const startingXPosition =
    -options.axisSettings.width + options.axisSettings.yTitleSize;

  const yPositionSignalWithOffset = (offset = 0) =>
    `brushMeasureIn !== null ? (scale("yscale",brushMeasureIn) + ${offset}) : 0`;

  const referenceLines: GroupMark = {
    name: 'y_reference_line_group',
    type: 'group',
    marks: [
      {
        name: 'y_reference_lines_backdrop',
        type: 'rect',
        encode: {
          enter: {
            x: {
              value: startingXPosition - 2,
            },
            x2: {value: 0},
            fill: {
              value: {
                'x1': 1,
                'y1': 0,
                'x2': 1,
                'y2': 1,
                'gradient': 'linear',
                'stops': [
                  {offset: 0, color: 'rgba(255,255,255,0)'},
                  {offset: 0.275, color: 'white'},
                  {offset: 0.7, color: 'white'},
                  {offset: 1, color: 'rgba(255,255,255,0)'},
                ],
              },
            },
            height: {value: 40},
          },
          update: {
            y: {
              signal: yPositionSignalWithOffset(-25),
            },
            opacity: opacityRefLineSignal,
          },
        },
      },
      {
        name: 'y_reference_lines',
        type: 'rule',
        encode: {
          enter: {
            x: {
              value: startingXPosition,
            },
            x2: {signal: 'width'},
            stroke: {value: 'black'},
            strokeOpacity: {value: 0.5},
            strokeDash: {value: [4, 2]},
          },
          update: {
            y: {
              signal: yPositionSignalWithOffset(),
            },
            y2: {
              signal: yPositionSignalWithOffset(0),
            },
            opacity: opacityRefLineSignal,
          },
        },
      },
      {
        name: 'y_reference_line_label_backdrop',
        type: 'text',
        encode: {
          enter: {
            x: {
              value: startingXPosition,
            },
            dy: {value: -4},
            align: {value: 'left'},
            baseline: {value: 'alphabetic'},
            fill: {value: 'white'},
            stroke: {value: 'white'},
            strokeWidth: {value: 3},
            fontSize: {value: 10},
            fontWeight: {value: 'normal'},
            font: {signal: 'referenceLineFont'},
            strokeOpacity: {value: 1},
          },
          update: {
            y: {
              signal: yPositionSignalWithOffset(),
            },
            text: {
              signal: `brushMeasureIn ? renderMalloyNumber(malloyExplore, '${options.fieldPath}', brushMeasureIn) : ''`,
            },
            opacity: opacityRefLineSignal,
          },
        },
      },
      {
        name: 'y_reference_line_label',
        type: 'text',
        encode: {
          enter: {
            x: {
              value: startingXPosition,
            },
            dy: {value: -4},
            align: {value: 'left'},
            baseline: {value: 'alphabetic'},
            fill: {value: grayMedium},
            fontSize: {value: 10},
            fontWeight: {value: 'normal'},
            font: {signal: 'referenceLineFont'},
          },
          update: {
            y: {
              signal: yPositionSignalWithOffset(),
            },
            text: {
              signal: `brushMeasureIn ? renderMalloyNumber(malloyExplore, '${options.fieldPath}', brushMeasureIn) : ''`,
            },
            opacity: opacityRefLineSignal,
          },
        },
      },
    ],
  };
  return referenceLines;
}

// type AxisRangeOptions = {
//   type: 'y';
//   fieldPath: string;
//   axisSettings: {
//     width: number;
//     yTitleSize: number;
//   };
//   fieldRef: string | null;
//   brushMeasureRangeSourceId: string;
// };

// function createAxisRangeBrush(options: AxisRangeOptions) {
//   const getXPositionSignalWithOffset = (offset = 0) =>
//     `-${options.axisSettings.width} + ${options.axisSettings.yTitleSize} + ${offset}`;
//   const getY0PositionSignalWithOffset = (offset = 0) =>
//     `brushMeasureRangeIn ? scale("yscale",brushMeasureRangeIn[0])+${offset} : 0`;
//   const getY1PositionSignalWithOffset = (offset = 0) =>
//     `brushMeasureRangeIn ? scale("yscale",brushMeasureRangeIn[1])+${offset} : 0`;

//   const yAxisRangeBrushRect: VegaSpec = {
//     name: 'y_axis_range_brush',
//     type: 'rect',
//     encode: {
//       enter: {
//         x: {
//           signal: getXPositionSignalWithOffset(-4),
//         },
//         x2: {signal: 'width'},
//         fill: {
//           'value': '#4c72ba',
//         },
//         fillOpacity: {value: 0.1},
//       },
//       update: {
//         y: {
//           signal: getY0PositionSignalWithOffset(),
//         },
//         y2: {
//           signal: getY1PositionSignalWithOffset(),
//         },
//       },
//     },
//   };

//   const yAxisRangeBrush: VegaSpec = {
//     type: 'group',
//     marks: [
//       yAxisRangeBrushRect,
//       // y range lines
//       {
//         type: 'rule',
//         encode: {
//           enter: {
//             x: {
//               signal: getXPositionSignalWithOffset(-4),
//             },
//             x2: {signal: 'width'},
//             stroke: {value: '#b5bcc9'},
//             strokeWidth: {value: 0.5},
//           },
//           update: {
//             y: {
//               signal: getY0PositionSignalWithOffset(0.5),
//             },
//             y2: {
//               signal: getY0PositionSignalWithOffset(0.5),
//             },
//             opacity: [
//               {
//                 test: 'brushMeasureRangeIn',
//                 value: 1,
//               },
//               {value: 0},
//             ],
//           },
//         },
//       },
//       {
//         type: 'rule',
//         encode: {
//           enter: {
//             x: {
//               signal: getXPositionSignalWithOffset(-4),
//             },
//             x2: {signal: 'width'},
//             stroke: {value: '#b5bcc9'},
//             strokeWidth: {value: 0.5},
//           },

//           update: {
//             y: {
//               signal: getY1PositionSignalWithOffset(),
//             },
//             y2: {
//               signal: getY1PositionSignalWithOffset(),
//             },
//             opacity: [
//               {
//                 test: 'brushMeasureRangeIn',
//                 value: 1,
//               },
//               {value: 0},
//             ],
//           },
//         },
//       },
//       // y range labels
//       {
//         name: 'y_range_label_backdrop',
//         type: 'text',
//         encode: {
//           // TODO: reuse across marks, get values from config?
//           enter: {
//             x: {
//               signal: getXPositionSignalWithOffset(),
//             },
//             dy: {value: 11},
//             align: {value: 'left'},
//             baseline: {value: 'alphabetic'},
//             fill: {value: 'white'},
//             stroke: {value: 'white'},
//             strokeWidth: {value: 3},
//             fontSize: {value: 10},
//             fontWeight: {value: 'normal'},
//             font: {signal: "referenceLineFont"},
//             strokeOpacity: {value: 1},
//           },
//           update: {
//             y: {
//               signal: getY0PositionSignalWithOffset(0),
//             },
//             text: {
//               signal: `brushMeasureRangeIn ? renderMalloyNumber(malloyExplore, '${options.fieldPath}', brushMeasureRangeIn[0]) : ''`,
//             },
//             opacity: [
//               {
//                 test: 'brushMeasureRangeIn',
//                 value: 1,
//               },
//               {value: 0},
//             ],
//           },
//         },
//       },
//       {
//         name: 'y_range_line_label',
//         type: 'text',
//         encode: {
//           enter: {
//             x: {
//               signal: getXPositionSignalWithOffset(),
//             },
//             dy: {value: 11},
//             align: {value: 'left'},
//             baseline: {value: 'alphabetic'},
//             fill: {value: grayMedium},
//             fontSize: {value: 10},
//             fontWeight: {value: 'normal'},
//             font: {signal: "referenceLineFont"},
//           },
//           update: {
//             y: {
//               signal: getY0PositionSignalWithOffset(0),
//             },
//             text: {
//               signal: `brushMeasureRangeIn ? renderMalloyNumber(malloyExplore, '${options.fieldPath}', brushMeasureRangeIn[0]) : ''`,
//             },
//             opacity: [
//               {
//                 test: 'brushMeasureRangeIn',
//                 value: 1,
//               },
//               {value: 0},
//             ],
//           },
//         },
//       },
//       {
//         name: 'y_range_label_backdrop_2',
//         type: 'text',
//         encode: {
//           // TODO: reuse across marks, get values from config?
//           enter: {
//             x: {
//               signal: getXPositionSignalWithOffset(0),
//             },
//             dy: {value: -4},
//             align: {value: 'left'},
//             baseline: {value: 'alphabetic'},
//             fill: {value: 'white'},
//             stroke: {value: 'white'},
//             strokeWidth: {value: 3},
//             fontSize: {value: 10},
//             fontWeight: {value: 'normal'},
//             font: {signal: "referenceLineFont"},
//             strokeOpacity: {value: 1},
//           },
//           update: {
//             y: {
//               signal: getY1PositionSignalWithOffset(0),
//             },
//             text: {
//               signal: `brushMeasureRangeIn ? renderMalloyNumber(malloyExplore, '${options.fieldPath}', brushMeasureRangeIn[1]) : ''`,
//             },
//             opacity: [
//               {
//                 test: 'brushMeasureRangeIn',
//                 value: 1,
//               },
//               {value: 0},
//             ],
//           },
//         },
//       },
//       {
//         name: 'y_range_line_label_2',
//         type: 'text',
//         encode: {
//           enter: {
//             x: {
//               signal: getXPositionSignalWithOffset(0),
//             },
//             dy: {value: -4},
//             align: {value: 'left'},
//             baseline: {value: 'alphabetic'},
//             fill: {value: grayMedium},
//             fontSize: {value: 10},
//             fontWeight: {value: 'normal'},
//             font: {signal: "referenceLineFont"},
//           },
//           update: {
//             y: {
//               signal: getY1PositionSignalWithOffset(0),
//             },
//             text: {
//               signal: `brushMeasureRangeIn ? renderMalloyNumber(malloyExplore, '${options.fieldPath}', brushMeasureRangeIn[1]) : ''`,
//             },
//             opacity: [
//               {
//                 test: 'brushMeasureRangeIn',
//                 value: 1,
//               },
//               {value: 0},
//             ],
//           },
//         },
//       },
//     ],
//   };
//   const yAxisRangeSignals = [
//     // y brush
//     {
//       name: 'yRangeBrush',
//       on: [
//         {
//           events: '@y_axis_overlay:mousedown',
//           update:
//             "event.shiftKey ? [invert('yscale',y()), invert('yscale',y())] : [snapValue([domain('yscale')[0],domain('yscale')[1]], 1000,invert('yscale',y())), snapValue([domain('yscale')[0],domain('yscale')[1]], 1000,invert('yscale',y()))]",
//         },
//         {
//           'events':
//             '[@y_axis_overlay:mousedown, window:mouseup] > window:mousemove!',
//           'update':
//             "event.shiftKey ? [yRangeBrush[0], invert('yscale',clamp(y(), 0, height))]: [snapValue([domain('yscale')[0],domain('yscale')[1]], 1000,yRangeBrush[0]), snapValue([domain('yscale')[0],domain('yscale')[1]], 1000,invert('yscale',clamp(y(), 0, height)))]",
//         },
//         // shortcut to clear it? if click clears it, then we can't move it
//         // TODO for now, double click. later can work in moving, edge move handle semantics
//         // TODO: no way to clear range brush from other charts
//         {
//           'events': '@y_axis_range_brush:dblclick',
//           'update': 'null',
//         },
//       ],
//     },
//     {
//       name: 'yRangeBrushSorted',
//       update: 'yRangeBrush ? extent(yRangeBrush) : null',
//     },
//     {
//       name: 'yRangeBrushValues',
//       update: 'yRangeBrushSorted',
//     },
//     {
//       // TODO: label the outs as Out
//       name: 'brushMeasureRange',
//       // instead of options.fieldRef here, can't we use measureFieldRefId signal?
//       update: `yRangeBrushValues && yRangeBrushValues[0] !== yRangeBrushValues[1] ? { fieldRefId: '${options.fieldRef}', sourceId: '${options.brushMeasureRangeSourceId}', value: yRangeBrushValues, type: 'measure-range'} : null`,
//     },
//   ];

//   return {mark: yAxisRangeBrush, signals: yAxisRangeSignals};
// }
