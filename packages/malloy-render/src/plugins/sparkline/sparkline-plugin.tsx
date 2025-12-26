import type {
  RenderPluginFactory,
  RenderProps,
  SolidJSRenderPluginInstance,
} from '@/api/plugin-types';
import {type Field, FieldType, type NestField} from '@/data_tree';
import {Tag} from '@malloydata/malloy-tag';
import type {JSXElement} from 'solid-js';
import {SparklineComponent} from './sparkline-component';
import {
  type SparklineSettings,
  type SparklineType,
  type SparklineSize,
  defaultSparklineSettings,
  sparklineSettingsSchema,
} from './sparkline-settings';
import {MalloyViz} from '@/api/malloy-viz';
import styles from './sparkline.css?raw';
import type {JSONSchemaObject} from '@/api/json-schema-types';

/**
 * Metadata returned by the Sparkline plugin
 */
interface SparklinePluginMetadata {
  type: 'sparkline';
  field: NestField;
  settings: SparklineSettings;
}

/**
 * Sparkline plugin instance type
 */
export interface SparklinePluginInstance
  extends SolidJSRenderPluginInstance<SparklinePluginMetadata> {
  field: NestField;
  // Optional CoreViz methods for storybook compatibility
  getSchema?: () => JSONSchemaObject;
  getSettings?: () => Record<string, unknown>;
  getDefaultSettings?: () => Record<string, unknown>;
  settingsToTag?: (settings: Record<string, unknown>) => Tag;
}

/**
 * Extract Sparkline settings from field tags
 */
function getSparklineSettings(field: Field): SparklineSettings {
  const tag = field.tag;
  const sparklineTag = tag.tag('sparkline');

  // Get type from tag or use default
  const typeText = sparklineTag?.text('type');
  const type: SparklineType =
    typeText === 'line' || typeText === 'area' || typeText === 'bar'
      ? typeText
      : defaultSparklineSettings.type;

  // Get size from tag or use default
  const sizeText = sparklineTag?.text('size');
  const size: SparklineSize =
    sizeText === 'xs' ||
    sizeText === 'sm' ||
    sizeText === 'md' ||
    sizeText === 'lg' ||
    sizeText === 'xl'
      ? sizeText
      : defaultSparklineSettings.size;

  return {
    type,
    size,
  };
}

/**
 * Sparkline Plugin Factory
 *
 * Renders nested data as a compact sparkline visualization.
 *
 * Usage in Malloy:
 *   # sparkline
 *   view: trend is {
 *     group_by: month
 *     aggregate: revenue is sale_price.sum()
 *     order_by: month
 *   }
 *
 * With options:
 *   # sparkline { type=area size=lg }
 *   view: trend is { ... }
 *
 * In a table (future):
 *   view: by_state is {
 *     group_by: state
 *     aggregate: total_cases
 *     # sparkline { size=xs }
 *     nest: trend is {
 *       group_by: date
 *       aggregate: new_cases
 *     }
 *   }
 */
export const SparklinePluginFactory: RenderPluginFactory<SparklinePluginInstance> =
  {
    name: 'sparkline',

    /**
     * Match fields with the # sparkline annotation
     */
    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasSparklineTag = fieldTag.has('sparkline');

      // Sparkline works with RepeatedRecord (nested data with rows)
      const isValidType = fieldType === FieldType.RepeatedRecord;

      if (hasSparklineTag && !isValidType) {
        throw new Error(
          'Malloy Sparkline: field must be a nested view (repeated record) with at least 2 fields'
        );
      }

      return hasSparklineTag && isValidType;
    },

    /**
     * Create a Sparkline plugin instance
     */
    create: (field: Field): SparklinePluginInstance => {
      if (!field.isNest()) {
        throw new Error('Sparkline: must be a nest field');
      }

      const settings = getSparklineSettings(field);

      const pluginInstance: SparklinePluginInstance = {
        name: 'sparkline',
        field,
        renderMode: 'solidjs',
        sizingStrategy: 'fixed',

        /**
         * Render the Sparkline component
         */
        renderComponent: (props: RenderProps): JSXElement => {
          // Add stylesheet
          MalloyViz.addStylesheet(styles);

          if (!props.dataColumn.isRepeatedRecord()) {
            throw new Error(
              'Malloy Sparkline: data column must be a repeated record'
            );
          }

          return (
            <SparklineComponent
              dataColumn={props.dataColumn}
              field={props.field}
              settings={settings}
            />
          );
        },

        /**
         * Return metadata about this plugin instance
         */
        getMetadata: (): SparklinePluginMetadata => ({
          type: 'sparkline',
          field,
          settings,
        }),

        // CoreViz-compatible methods for storybook compatibility
        getSchema: () => sparklineSettingsSchema,
        getSettings: () => settings as Record<string, unknown>,
        getDefaultSettings: () =>
          defaultSparklineSettings as Record<string, unknown>,
        settingsToTag: (s: Record<string, unknown>) => {
          const tag = new Tag();
          const sparklineSettings = s as SparklineSettings;

          if (
            sparklineSettings.type &&
            sparklineSettings.type !== defaultSparklineSettings.type
          ) {
            tag.set(['sparkline', 'type'], sparklineSettings.type);
          }
          if (
            sparklineSettings.size &&
            sparklineSettings.size !== defaultSparklineSettings.size
          ) {
            tag.set(['sparkline', 'size'], sparklineSettings.size);
          }

          return tag;
        },
      };

      return pluginInstance;
    },
  };
