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
} from '@/api/json-schema-types';

// TypeScript type definition
export interface BarChartSettings extends Record<string, unknown> {
  xChannel: Channel;
  yChannel: YChannel;
  seriesChannel: SeriesChannel;
  isStack: boolean;
  interactive: boolean;
  hideReferences: boolean;
  disableEmbedded: boolean;
  size?:
    | 'fill'
    | 'spark'
    | 'xs'
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl'
    | '2xl'
    | {width: number; height: number};
}

// Default settings object
export const defaultBarChartSettings: BarChartSettings = {
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
  isStack: false,
  interactive: true,
  hideReferences: false,
  disableEmbedded: false,
  size: 'fill',
};

// Specific typed interface for the bar chart schema
export interface IBarChartSettingsSchema extends JSONSchemaObject {
  properties: {
    xChannel: JSONSchemaObject & {
      properties: {
        fields: JSONSchemaArray & {
          items: JSONSchemaString;
        };
        type: JSONSchemaString;
        independent: JSONSchemaString;
      };
    };
    yChannel: JSONSchemaObject & {
      properties: {
        fields: JSONSchemaArray & {
          items: JSONSchemaString;
        };
        type: JSONSchemaString;
        independent: JSONSchemaBoolean;
      };
    };
    seriesChannel: JSONSchemaObject & {
      properties: {
        fields: JSONSchemaArray & {
          items: JSONSchemaString;
        };
        type: JSONSchemaString;
        independent: JSONSchemaString;
        limit: JSONSchemaOneOf;
      };
    };
    isStack: JSONSchemaBoolean;
    interactive: JSONSchemaBoolean;
    hideReferences: JSONSchemaBoolean;
    disableEmbedded: JSONSchemaBoolean;
    size?: JSONSchemaOneOf;
  };
}

// JSON Schema
export const barChartSettingsSchema: IBarChartSettingsSchema = {
  title: 'Bar Chart Settings',
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
            'Maximum number of series to display in the chart. "auto" means chart determines optimal limit (default 20)',
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
    isStack: {
      title: 'Stacked Bars',
      description: 'Whether to stack bars when multiple series are present',
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
    hideReferences: {
      title: 'Hide References',
      description: 'Whether to hide reference lines and spark styling',
      type: 'boolean',
      default: false,
    },
    disableEmbedded: {
      title: 'Disable Embedded Tags',
      description:
        'Whether to ignore field-level tags for x, y, and series channel assignment',
      type: 'boolean',
      default: false,
    },
    size: {
      title: 'Chart Size',
      description:
        'Size preset (xs, sm, md, lg, xl, 2xl) or custom dimensions with width and height',
      type: 'oneOf',
      oneOf: [
        {
          type: 'string',
          enum: ['fill', 'spark', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
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
    'isStack',
    'interactive',
    'hideReferences',
    'disableEmbedded',
  ],
  additionalProperties: false,
};
