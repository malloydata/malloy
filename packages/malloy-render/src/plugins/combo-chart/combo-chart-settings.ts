/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {XChannel, YChannel} from '@/component/types';
import type {
  JSONSchemaObject,
  JSONSchemaArray,
  JSONSchemaString,
  JSONSchemaNumber,
  JSONSchemaBoolean,
  JSONSchemaOneOf,
} from '@/api/json-schema-types';

// The mark types a measure can be drawn as on one of the two axes. Single
// source of truth: the type, the settings-schema enums, the tag parser, and the
// dispatch-time validator all derive from this one array.
export const COMBO_MARK_TYPES = ['bar', 'line'] as const;
export type ComboMarkType = (typeof COMBO_MARK_TYPES)[number];

// A y channel that also carries which mark type draws its measures. Axis side
// is implied by the channel: `yChannel` is the left axis, `y2Channel` the right.
export type ComboYChannel = YChannel & {
  chart: ComboMarkType;
  // Line-only styling (ignored when `chart` is 'bar'):
  // stroke width in px (default 2 when unset).
  lineWidth?: number;
  // force point (dot) visibility; unset = auto (dots hidden once a series has
  // more than one point, matching line_chart).
  showPoints?: boolean;
  // Explicit axis domain bounds. Pinning both axes to comparable ranges is how
  // you defuse the misleading-crossover pitfall of independent dual scales.
  // Either end may be pinned alone; the unpinned end still comes from the data.
  min?: number;
  max?: number;
};

// TypeScript type definition
export interface ComboChartSettings extends Record<string, unknown> {
  xChannel: XChannel;
  // Primary (left) axis measures.
  yChannel: ComboYChannel;
  // Secondary (right) axis measures.
  y2Channel: ComboYChannel;
  interactive: boolean;
  // Tint each axis to its mark's color so the two independent scales read as
  // separate rulers. On by default; set `color_axes=false` to opt out.
  colorAxes: boolean;
  disableEmbedded: boolean;
}

// Default settings object. The classic combo is bars on the left, a line on the
// right, so the mark defaults differ per channel.
export const defaultComboChartSettings: ComboChartSettings = {
  xChannel: {
    fields: [],
    type: 'nominal',
    independent: 'auto',
    limit: 'auto',
  },
  yChannel: {
    fields: [],
    type: 'quantitative',
    independent: false,
    chart: 'bar',
  },
  y2Channel: {
    fields: [],
    type: 'quantitative',
    independent: false,
    chart: 'line',
  },
  interactive: true,
  colorAxes: true,
  disableEmbedded: false,
};

// Specific typed interface for the combo chart schema
export interface IComboChartSettingsSchema extends JSONSchemaObject {
  properties: {
    xChannel: JSONSchemaObject & {
      properties: {
        fields: JSONSchemaArray & {
          items: JSONSchemaString;
        };
        type: JSONSchemaString;
        independent: JSONSchemaString;
        limit: JSONSchemaOneOf;
      };
    };
    yChannel: JSONSchemaObject & {
      properties: {
        fields: JSONSchemaArray & {
          items: JSONSchemaString;
        };
        type: JSONSchemaString;
        independent: JSONSchemaBoolean;
        chart: JSONSchemaString;
        lineWidth: JSONSchemaNumber;
        showPoints: JSONSchemaBoolean;
        min: JSONSchemaNumber;
        max: JSONSchemaNumber;
      };
    };
    y2Channel: JSONSchemaObject & {
      properties: {
        fields: JSONSchemaArray & {
          items: JSONSchemaString;
        };
        type: JSONSchemaString;
        independent: JSONSchemaBoolean;
        chart: JSONSchemaString;
        lineWidth: JSONSchemaNumber;
        showPoints: JSONSchemaBoolean;
        min: JSONSchemaNumber;
        max: JSONSchemaNumber;
      };
    };
    interactive: JSONSchemaBoolean;
    colorAxes: JSONSchemaBoolean;
    disableEmbedded: JSONSchemaBoolean;
  };
}

// JSON Schema
export const comboChartSettingsSchema: IComboChartSettingsSchema = {
  title: 'Combo Chart Settings',
  type: 'object',
  properties: {
    xChannel: {
      title: 'X-Axis Channel',
      type: 'object',
      properties: {
        fields: {
          title: 'X-Axis Fields',
          description: 'Array of field paths to use for the X-axis',
          type: 'array',
          items: {
            type: 'string',
            subtype: 'field',
          },
          default: [],
        },
        type: {
          title: 'X-Axis Scale Type',
          description: 'Scale type for X-axis data encoding',
          type: 'string',
          enum: ['quantitative', 'nominal'],
          default: 'nominal',
        },
        independent: {
          title: 'X-Axis Independence',
          description:
            'Whether X-axis domains should be independent across chart rows. "auto" means shared when ≤20 distinct values',
          type: 'string',
          enum: ['auto', 'true', 'false'],
          default: 'auto',
        },
        limit: {
          title: 'X-Axis Limit',
          description:
            'Maximum number of x-axis values to display. "auto" means chart determines optimal limit from plot width',
          type: 'oneOf',
          oneOf: [
            {
              type: 'string',
              enum: ['auto'],
            },
            {
              type: 'number',
              minimum: 1,
            },
          ],
          default: 'auto',
        },
      },
      required: ['fields', 'type'],
    },
    yChannel: {
      title: 'Left Y-Axis Channel',
      type: 'object',
      properties: {
        fields: {
          title: 'Left Y-Axis Fields',
          description:
            'Array of field paths drawn on the primary (left) y-axis',
          type: 'array',
          items: {
            type: 'string',
            subtype: 'field',
            fieldTypes: ['number_type'],
          },
          default: [],
        },
        type: {
          title: 'Left Y-Axis Scale Type',
          description: 'Scale type for data encoding',
          type: 'string',
          enum: ['quantitative', 'nominal'],
          default: 'quantitative',
        },
        independent: {
          title: 'Left Y-Axis Independence',
          description:
            'Whether the axis domain should be independent across chart rows.',
          type: 'boolean',
          default: false,
        },
        chart: {
          title: 'Left Y-Axis Mark Type',
          description:
            'Which mark type draws the measures on this axis: "bar" or "line".',
          type: 'string',
          enum: [...COMBO_MARK_TYPES],
          default: 'bar',
        },
        lineWidth: {
          title: 'Left Line Width',
          description:
            'Stroke width (px) when this axis is drawn as a line. Ignored for bars.',
          type: 'number',
          minimum: 0,
        },
        showPoints: {
          title: 'Left Line Points',
          description:
            'Show point markers on the line. Unset = auto (hidden once a series has more than one point). Ignored for bars.',
          type: 'boolean',
        },
        min: {
          title: 'Left Axis Min',
          description:
            'Pin the bottom of the left axis. Unset = derived from the data.',
          type: 'number',
        },
        max: {
          title: 'Left Axis Max',
          description:
            'Pin the top of the left axis. Unset = derived from the data.',
          type: 'number',
        },
      },
      required: ['fields', 'type', 'chart'],
    },
    y2Channel: {
      title: 'Right Y-Axis Channel',
      type: 'object',
      properties: {
        fields: {
          title: 'Right Y-Axis Fields',
          description:
            'Array of field paths drawn on the secondary (right) y-axis',
          type: 'array',
          items: {
            type: 'string',
            subtype: 'field',
            fieldTypes: ['number_type'],
          },
          default: [],
        },
        type: {
          title: 'Right Y-Axis Scale Type',
          description: 'Scale type for data encoding',
          type: 'string',
          enum: ['quantitative', 'nominal'],
          default: 'quantitative',
        },
        independent: {
          title: 'Right Y-Axis Independence',
          description:
            'Whether the axis domain should be independent across chart rows.',
          type: 'boolean',
          default: false,
        },
        chart: {
          title: 'Right Y-Axis Mark Type',
          description:
            'Which mark type draws the measures on this axis: "bar" or "line".',
          type: 'string',
          enum: [...COMBO_MARK_TYPES],
          default: 'line',
        },
        lineWidth: {
          title: 'Right Line Width',
          description:
            'Stroke width (px) when this axis is drawn as a line. Ignored for bars.',
          type: 'number',
          minimum: 0,
        },
        showPoints: {
          title: 'Right Line Points',
          description:
            'Show point markers on the line. Unset = auto (hidden once a series has more than one point). Ignored for bars.',
          type: 'boolean',
        },
        min: {
          title: 'Right Axis Min',
          description:
            'Pin the bottom of the right axis. Unset = derived from the data.',
          type: 'number',
        },
        max: {
          title: 'Right Axis Max',
          description:
            'Pin the top of the right axis. Unset = derived from the data.',
          type: 'number',
        },
      },
      required: ['fields', 'type', 'chart'],
    },
    interactive: {
      title: 'Interactive',
      description:
        'Whether the chart should be interactive (tooltips, zoom, etc.)',
      type: 'boolean',
      default: true,
    },
    colorAxes: {
      title: 'Color Axes',
      description:
        "Tint each axis (title, ticks, axis line) to its mark's color so the two independent scales read as separate rulers. Set false to keep neutral axes.",
      type: 'boolean',
      default: true,
    },
    disableEmbedded: {
      title: 'Disable Embedded Tags',
      description:
        'Whether to ignore field-level tags for x, y, and y2 channel assignment',
      type: 'boolean',
      default: false,
    },
  },
  required: [
    'xChannel',
    'yChannel',
    'y2Channel',
    'interactive',
    'colorAxes',
    'disableEmbedded',
  ],
  additionalProperties: false,
};
