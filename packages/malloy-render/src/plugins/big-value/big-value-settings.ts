import type {JSONSchemaObject} from '@/api/json-schema-types';

/**
 * Size preset for big value cards
 */
export type BigValueSize = 'sm' | 'md' | 'lg';

/**
 * Comparison format type
 * - 'pct': Percentage change (e.g., +5.2%)
 * - 'ppt': Percentage point difference (e.g., +5.0 ppt)
 */
export type ComparisonFormat = 'pct' | 'ppt';

/**
 * Settings for the Big Value plugin
 */
export interface BigValueSettings {
  /** Size preset for the cards */
  size: BigValueSize;
}

/**
 * Comparison information extracted from field tags
 * Used when a field has # big_value { comparison_field=... }
 */
export interface BigValueComparisonInfo {
  /** The field name of the primary metric this comparison refers to */
  comparisonField: string;
  /** Optional label shown next to the delta (e.g., 'vs Prior Year') */
  comparisonLabel?: string;
  /** Format for the comparison: 'pct' for percentage change, 'ppt' for percentage points */
  comparisonFormat: ComparisonFormat;
  /** If true, a decrease is shown as positive (green) instead of negative */
  downIsGood: boolean;
}

/**
 * Default settings for the Big Value plugin
 */
export const defaultBigValueSettings: BigValueSettings = {
  size: 'md',
};

/**
 * JSON Schema for Big Value settings
 */
export const bigValueSettingsSchema: JSONSchemaObject = {
  type: 'object',
  properties: {
    size: {
      type: 'string',
      enum: ['sm', 'md', 'lg'],
      default: 'md',
      description: 'Size preset for the big value cards',
    },
  },
};

/**
 * Type for the settings schema
 */
export type IBigValueSettingsSchema = typeof bigValueSettingsSchema;
