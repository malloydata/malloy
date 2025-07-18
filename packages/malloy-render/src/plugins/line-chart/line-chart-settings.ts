/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Channel, SeriesChannel, YChannel} from '@/component/types';
import type {
  JSONSchemaObject,
  JSONSchemaArray,
  JSONSchemaString,
  JSONSchemaBoolean,
  JSONSchemaOneOf,
  JSONSchemaFieldString,
} from '@/api/json-schema-types';

// TypeScript type definition
export interface LineChartSettings extends Record<string, unknown> {
  xChannel: Channel;
  yChannel: YChannel;
  seriesChannel: SeriesChannel;
  zeroBaseline: boolean;
  interactive: boolean;
  disableEmbedded: boolean;
  mode?: 'yoy' | 'normal';
  size?:
    | 'fill'
    | 'xs'
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl'
    | '2xl'
    | {width: number; height: number};
}

// Plugin options interface for JavaScript API
export interface LineChartPluginOptions {
  defaults?: Partial<LineChartSettings>;
}

// Default settings object
export const defaultLineChartSettings: LineChartSettings = {
  xChannel: {
    fields: [],
    type: 'nominal',
    independent: 'auto',
  },
  yChannel: {
    fields: [],
    type: 'quantitative',
    independent: false,
  },
  seriesChannel: {
    fields: [],
    type: 'nominal',
    independent: 'auto',
    limit: 'auto',
  },
  zeroBaseline: false,
  interactive: true,
  disableEmbedded: false,
  mode: 'normal',
  size: 'fill',
};

// Specific typed interface for the line chart schema
export interface ILineChartSettingsSchema extends JSONSchemaObject {
  properties: {
    xChannel: JSONSchemaObject & {
      properties: {
        fields: JSONSchemaArray & {
          items: JSONSchemaFieldString;
        };
        type: JSONSchemaString;
        independent: JSONSchemaString;
      };
    };
    yChannel: JSONSchemaObject & {
      properties: {
        fields: JSONSchemaArray & {
          items: JSONSchemaFieldString;
        };
        type: JSONSchemaString;
        independent: JSONSchemaBoolean;
      };
    };
    seriesChannel: JSONSchemaObject & {
      properties: {
        fields: JSONSchemaArray & {
          items: JSONSchemaFieldString;
        };
        type: JSONSchemaString;
        independent: JSONSchemaString;
        limit: JSONSchemaOneOf;
      };
    };
    zeroBaseline: JSONSchemaBoolean;
    interactive: JSONSchemaBoolean;
    disableEmbedded: JSONSchemaBoolean;
    mode: JSONSchemaString;
    size?: JSONSchemaOneOf;
  };
}

// JSON Schema
export const lineChartSettingsSchema: ILineChartSettingsSchema = {
  title: 'Line Chart Settings',
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
      },
      required: ['fields', 'type'],
    },
    yChannel: {
      title: 'Y-Axis Channel',
      type: 'object',
      properties: {
        fields: {
          title: 'Y-Axis Fields',
          description: 'Array of field paths to use for the Y-axis',
          type: 'array',
          items: {
            type: 'string',
            subtype: 'field',
            fieldTypes: ['number_type'],
          },
          default: [],
        },
        type: {
          title: 'Y-Axis Scale Type',
          description: 'Scale type for Y-axis data encoding',
          type: 'string',
          enum: ['quantitative', 'nominal'],
          default: 'quantitative',
        },
        independent: {
          title: 'Y-Axis Independence',
          description:
            'Whether Y-axis domains should be independent across chart rows. Implementation will automatically enable when series limiting is active',
          type: 'boolean',
          default: false,
        },
      },
      required: ['fields', 'type'],
    },
    seriesChannel: {
      title: 'Series Channel',
      type: 'object',
      properties: {
        fields: {
          title: 'Series Fields',
          description:
            'Array of field paths to use for grouping data into series',
          type: 'array',
          items: {
            type: 'string',
            subtype: 'field',
          },
          default: [],
        },
        type: {
          title: 'Series Scale Type',
          description: 'Scale type for series data encoding',
          type: 'string',
          enum: ['quantitative', 'nominal'],
          default: 'nominal',
        },
        independent: {
          title: 'Series Independence',
          description:
            'Whether series domains should be independent across chart rows. "auto" means shared when ≤20 distinct values',
          type: 'string',
          enum: ['auto', 'true', 'false'],
          default: 'auto',
        },
        limit: {
          title: 'Series Limit',
          description:
            'Maximum number of series to display in the chart. "auto" means chart determines optimal limit (default 12)',
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
    zeroBaseline: {
      title: 'Zero Baseline',
      description: 'Whether to include zero in the Y-axis scale',
      type: 'boolean',
      default: false,
    },
    interactive: {
      title: 'Interactive',
      description:
        'Whether the chart should be interactive (tooltips, zoom, etc.)',
      type: 'boolean',
      default: true,
    },
    disableEmbedded: {
      title: 'Disable Embedded Tags',
      description:
        'Whether to ignore field-level tags for x, y, and series channel assignment',
      type: 'boolean',
      default: false,
    },
    mode: {
      title: 'Chart Mode',
      description:
        'Chart rendering mode. "yoy" enables year-over-year mode for temporal data with granularity less than year',
      type: 'string',
      enum: ['normal', 'yoy'],
      default: 'normal',
    },
    size: {
      title: 'Chart Size',
      description:
        'Size preset (xs, sm, md, lg, xl, 2xl) or custom dimensions with width and height',
      type: 'oneOf',
      oneOf: [
        {
          type: 'string',
          enum: ['fill', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
        },
        {
          type: 'object',
          properties: {
            width: {
              type: 'number',
              minimum: 1,
            },
            height: {
              type: 'number',
              minimum: 1,
            },
          },
          required: ['width', 'height'],
        },
      ],
    },
  },
  required: [
    'xChannel',
    'yChannel',
    'seriesChannel',
    'zeroBaseline',
    'interactive',
    'disableEmbedded',
    'mode',
  ],
  additionalProperties: false,
};
