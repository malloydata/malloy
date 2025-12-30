import type {
  RenderPluginFactory,
  RenderProps,
  CoreVizPluginInstance,
} from '@/api/plugin-types';
import {type Field, FieldType, type NestField} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import type {JSXElement} from 'solid-js';
import {BigValueComponent} from './big-value-component';
import {
  type BigValueSettings,
  type BigValueSize,
  defaultBigValueSettings,
  bigValueSettingsSchema,
} from './big-value-settings';
import {MalloyViz} from '@/api/malloy-viz';
import styles from './big-value.css?raw';
import {bigValueSettingsToTag} from './settings-to-tag';

/**
 * Metadata returned by the Big Value plugin
 */
interface BigValuePluginMetadata {
  type: 'big_value';
  field: NestField;
  settings: BigValueSettings;
}

/**
 * Big Value plugin instance type
 * Extends CoreVizPluginInstance for storybook compatibility
 */
export interface BigValuePluginInstance
  extends CoreVizPluginInstance<BigValuePluginMetadata> {
  field: NestField;
}

/**
 * Extract Big Value settings from field tags
 */
function getBigValueSettings(field: Field): BigValueSettings {
  const tag = field.tag;
  const bigValueTag = tag.tag('big_value');

  // Get size from tag or use default
  const sizeText = bigValueTag?.text('size');
  const size: BigValueSize =
    sizeText === 'sm' || sizeText === 'md' || sizeText === 'lg'
      ? sizeText
      : defaultBigValueSettings.size;

  // Get neutralThreshold from tag or use default
  const neutralThresholdText = bigValueTag?.text('neutral_threshold');
  const neutralThreshold =
    neutralThresholdText !== undefined
      ? parseFloat(neutralThresholdText)
      : defaultBigValueSettings.neutralThreshold;

  return {
    size,
    neutralThreshold: isNaN(neutralThreshold)
      ? defaultBigValueSettings.neutralThreshold
      : neutralThreshold,
  };
}

/**
 * Big Value Plugin Factory
 *
 * Renders aggregate values as prominent metric cards.
 *
 * Usage in Malloy:
 *   # big_value
 *   run: my_source -> {
 *     aggregate:
 *       opportunity_count
 *       total_revenue
 *   }
 *
 * With comparison values:
 *   # big_value
 *   run: my_source -> {
 *     aggregate:
 *       opportunity_win_rate_ytd
 *       # big_value { comparison_field='opportunity_win_rate_ytd' comparison_label='vs Prior Year' comparison_format='ppt' }
 *       opportunity_win_rate_prior_year
 *   }
 */
export const BigValuePluginFactory: RenderPluginFactory<BigValuePluginInstance> =
  {
    name: 'big_value',

    /**
     * Match fields with the # big_value annotation
     */
    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasBigValueTag = fieldTag.has('big_value');

      // Big Value works with RepeatedRecord (query results) or Record (single row)
      const isValidType =
        fieldType === FieldType.RepeatedRecord ||
        fieldType === FieldType.Record;

      if (hasBigValueTag && !isValidType) {
        throw new Error(
          'Malloy Big Value: field must be a query result (repeated record or record)'
        );
      }

      return hasBigValueTag && isValidType;
    },

    /**
     * Create a Big Value plugin instance
     */
    create: (field: Field): BigValuePluginInstance => {
      if (!field.isNest()) {
        throw new Error('Big Value: must be a nest field');
      }

      const settings = getBigValueSettings(field);

      const pluginInstance: BigValuePluginInstance = {
        name: 'big_value',
        field,
        renderMode: 'solidjs',
        sizingStrategy: 'fixed',

        /**
         * Render the Big Value component
         */
        renderComponent: (props: RenderProps): JSXElement => {
          // Add stylesheet
          MalloyViz.addStylesheet(styles);

          if (
            !props.dataColumn.isRepeatedRecord() &&
            !props.dataColumn.isRecord()
          ) {
            throw new Error(
              'Malloy Big Value: data column must be a repeated record or record'
            );
          }

          return (
            <BigValueComponent
              dataColumn={props.dataColumn}
              field={props.field}
              settings={settings}
            />
          );
        },

        /**
         * Return metadata about this plugin instance
         */
        getMetadata: (): BigValuePluginMetadata => ({
          type: 'big_value',
          field,
          settings,
        }),

        // CoreViz-compatible methods for storybook compatibility
        getSchema: () => bigValueSettingsSchema,
        getSettings: () => settings,
        getDefaultSettings: () => defaultBigValueSettings,
        settingsToTag: (s: Record<string, unknown>) => {
          return bigValueSettingsToTag(s as unknown as BigValueSettings);
        },
      };

      return pluginInstance;
    },
  };
