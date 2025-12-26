import type {JSONSchemaObject} from '@/api/json-schema-types';

/**
 * Sparkline visualization types
 */
export type SparklineType = 'line' | 'area' | 'bar';

/**
 * Sparkline size presets
 * - xs: For table cells (60x16)
 * - sm: Small, for big-value cards (80x20)
 * - md: Medium, default (100x24)
 * - lg: Large, for big-value lg or standalone (150x32)
 * - xl: Extra large, standalone views (200x40)
 */
export type SparklineSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Sparkline plugin settings
 */
export interface SparklineSettings {
  /** Type of sparkline visualization */
  type: SparklineType;
  /** Size preset */
  size: SparklineSize;
}

/**
 * Default sparkline settings
 */
export const defaultSparklineSettings: SparklineSettings = {
  type: 'line',
  size: 'md',
};

/**
 * JSON Schema for sparkline settings (for UI generation)
 */
export const sparklineSettingsSchema: JSONSchemaObject = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['line', 'area', 'bar'],
      default: 'line',
      description: 'Type of sparkline visualization',
    },
    size: {
      type: 'string',
      enum: ['xs', 'sm', 'md', 'lg', 'xl'],
      default: 'md',
      description:
        'Size preset: xs (table), sm (small card), md (default), lg (large card), xl (standalone)',
    },
  },
};
