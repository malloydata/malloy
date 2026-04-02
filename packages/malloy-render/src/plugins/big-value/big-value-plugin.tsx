/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

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
  type BigValueTagConfig,
  type BigValueFieldConfig,
  type BigValueComparisonInfo,
  type ComparisonFormat,
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
 * Resolve all tag data for a child field at setup time.
 * This reads every tag the big_value component needs for this field,
 * so the component never accesses tags directly at render time.
 */
function resolveChildFieldTags(childField: Field): BigValueFieldConfig {
  const tag = childField.tag;

  // Label: # label annotation or snake_case conversion
  const label = tag.text('label') || childField.getLabel();

  // Description: # description annotation
  const description = tag.text('description') || null;

  // Comparison info: # big_value { comparison_field=... }
  let comparison: BigValueComparisonInfo | null = null;
  const comparisonField = tag.text('big_value', 'comparison_field');
  if (comparisonField) {
    const comparisonLabel =
      tag.text('big_value', 'comparison_label') ?? undefined;
    const comparisonFormat = (tag.text('big_value', 'comparison_format') ??
      'pct') as ComparisonFormat;
    const downIsGood = tag.text('big_value', 'down_is_good') === 'true';
    comparison = {
      comparisonField,
      comparisonLabel,
      comparisonFormat,
      downIsGood,
    };
  }

  // Sparkline reference: # big_value { sparkline=nest_name }
  const sparklineRef = tag.text('big_value', 'sparkline') || null;

  return {label, description, comparison, sparklineRef};
}

/**
 * Resolve all tag data for the big_value nest at setup time.
 * Walks child fields and extracts their tag data so the component
 * never needs to access tags at render time.
 */
function resolveBigValueTags(field: Field): BigValueTagConfig {
  const fieldConfigs = new Map<string, BigValueFieldConfig>();
  const sparklineNestNames = new Set<string>();

  if (!field.isNest()) return {fieldConfigs, sparklineNestNames};

  for (const childField of field.fields) {
    // Resolve tag data for every child field
    fieldConfigs.set(childField.name, resolveChildFieldTags(childField));

    // Detect sparkline nests: child nests with line_chart/bar_chart size=spark
    if (childField.isNest()) {
      const childTag = childField.tag;
      const isLineSpark =
        childTag.has('line_chart') &&
        childTag.text('line_chart', 'size') === 'spark';
      const isBarSpark =
        childTag.has('bar_chart') &&
        childTag.text('bar_chart', 'size') === 'spark';
      if (isLineSpark || isBarSpark) {
        sparklineNestNames.add(childField.name);
      }
    }
  }

  return {fieldConfigs, sparklineNestNames};
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
        // Child config tags (sparkline, comparison_field) are read by the
        // parent big_value plugin — not a match request for this field.
        const bigValueTag = fieldTag.tag('big_value');
        if (
          bigValueTag?.has('sparkline') ||
          bigValueTag?.has('comparison_field')
        ) {
          return false;
        }
        throw new Error(
          'Malloy Big Value: field must be a query result (repeated record or record). Try moving the tag to the line above the query, run, nest, or view declaration.'
        );
      }

      return hasBigValueTag && isValidType;
    },

    /**
     * Create a Big Value plugin instance.
     *
     * All tag reads happen here, at setup time (during setResult()),
     * before the component mounts. The component receives pre-resolved
     * data and never accesses tags directly.
     */
    create: (field: Field): BigValuePluginInstance => {
      if (!field.isNest()) {
        throw new Error('Big Value: must be a nest field');
      }

      const settings = getBigValueSettings(field);
      const tagConfig = resolveBigValueTags(field);

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
              tagConfig={tagConfig}
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
