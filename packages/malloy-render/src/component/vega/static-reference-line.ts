/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {GroupMark} from 'vega';

export interface StaticReferenceLine {
  y: number;
  label?: string;
  color?: string;
  style?: 'dashed' | 'solid' | 'dotted';
}

const STROKE_DASH_MAP: Record<string, number[]> = {
  dashed: [6, 4],
  dotted: [2, 2],
  solid: [],
};

/**
 * Generate Vega marks for static reference lines at fixed Y positions.
 * Returns a GroupMark containing rule + text marks for each reference line.
 */
export function createStaticReferenceLines(
  referenceLines: StaticReferenceLine[],
  options: {
    isHorizontal?: boolean;
  } = {}
): GroupMark {
  const {isHorizontal = false} = options;

  const marks: GroupMark['marks'] = [];

  for (let i = 0; i < referenceLines.length; i++) {
    const refLine = referenceLines[i];
    const color = refLine.color || '#E42C97';
    const strokeDash = STROKE_DASH_MAP[refLine.style || 'dashed'] ?? [6, 4];

    // Rule mark
    marks!.push({
      name: `static_ref_line_${i}`,
      type: 'rule',
      encode: {
        enter: isHorizontal
          ? {
              y: {value: 0},
              y2: {signal: 'height'},
              x: {scale: 'yscale', value: refLine.y},
              stroke: {value: color},
              strokeWidth: {value: 1.5},
              strokeDash: {value: strokeDash},
              strokeOpacity: {value: 0.8},
            }
          : {
              x: {value: 0},
              x2: {signal: 'width'},
              y: {scale: 'yscale', value: refLine.y},
              stroke: {value: color},
              strokeWidth: {value: 1.5},
              strokeDash: {value: strokeDash},
              strokeOpacity: {value: 0.8},
            },
      },
    });

    // Label mark (if label is provided)
    if (refLine.label) {
      marks!.push({
        name: `static_ref_label_${i}`,
        type: 'text',
        encode: {
          enter: isHorizontal
            ? {
                x: {scale: 'yscale', value: refLine.y},
                y: {value: -4},
                text: {value: refLine.label},
                fill: {value: color},
                fontSize: {value: 10},
                fontWeight: {value: 'normal'},
                font: {signal: 'referenceLineFont'},
                align: {value: 'center'},
                baseline: {value: 'bottom'},
              }
            : {
                x: {signal: 'width'},
                y: {scale: 'yscale', value: refLine.y},
                dx: {value: -4},
                dy: {value: -4},
                text: {value: refLine.label},
                fill: {value: color},
                fontSize: {value: 10},
                fontWeight: {value: 'normal'},
                font: {signal: 'referenceLineFont'},
                align: {value: 'right'},
                baseline: {value: 'bottom'},
              },
        },
      });
    }
  }

  return {
    name: 'static_reference_lines',
    type: 'group',
    marks,
  };
}
