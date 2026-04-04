/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  RenderPluginFactory,
  RenderProps,
  CoreVizPluginInstance,
  RendererValidationSpec,
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

const BIG_VALUE_CHILD_TAG_PATHS: string[][] = [
  ['big_value', 'comparison_field'],
  ['big_value', 'comparison_label'],
  ['big_value', 'comparison_format'],
  ['big_value', 'down_is_good'],
  ['big_value', 'sparkline'],
];

const BIG_VALUE_OWNED_PATHS: string[][] = [
  ['big_value', 'size'],
  ['big_value', 'neutral_threshold'],
];

const BIG_VALUE_PARENT_TAG_PROPS = ['size', 'neutral_threshold'];

const BIG_VALUE_VALIDATION_SPEC: RendererValidationSpec = {
  renderer: 'big_value',
  ownedPaths: BIG_VALUE_OWNED_PATHS,
  childOwnedPaths: BIG_VALUE_CHILD_TAG_PATHS,
};

/**
 * Convert snake_case to Title Case
 */
function snakeToTitleCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
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

function resolveChildDisplayTags(
  childField: Field
): Pick<BigValueFieldConfig, 'label' | 'description'> {
  const tag = childField.tag;

  // Label: # label annotation or snake_case conversion
  const label = tag.text('label') || snakeToTitleCase(childField.name);

  // Description: # description annotation
  const description = tag.text('description') || null;

  return {label, description};
}

function resolveBigValueChildConfig(
  childField: Field
): Pick<BigValueFieldConfig, 'comparison' | 'sparklineRef'> {
  const tag = childField.tag;

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

  return {comparison, sparklineRef};
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

    getValidationSpec: (): RendererValidationSpec => BIG_VALUE_VALIDATION_SPEC,

    /**
     * Match fields with the # big_value annotation
     */
    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasBigValueTag = fieldTag.has('big_value');
      const bigValueTag = fieldTag.tag('big_value');
      const hasChildConfigTag = BIG_VALUE_CHILD_TAG_PATHS.some(
        ([, childProp]) =>
          childProp !== undefined && bigValueTag?.has(childProp)
      );
      const hasParentConfigTag = BIG_VALUE_PARENT_TAG_PROPS.some(prop =>
        bigValueTag?.has(prop)
      );

      if (hasChildConfigTag && !hasParentConfigTag) {
        return false;
      }

      // Big Value works with RepeatedRecord (query results) or Record (single row)
      const isValidType =
        fieldType === FieldType.RepeatedRecord ||
        fieldType === FieldType.Record;

      if (hasBigValueTag && !isValidType) {
        // Child config tags (sparkline, comparison_field) are read by the
        // parent big_value plugin — not a match request for this field.
        if (hasChildConfigTag) {
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
      const fieldConfigs = new Map<string, BigValueFieldConfig>();
      const sparklineNestNames = new Set<string>();

      // Seed each child with globally meaningful display metadata first.
      // Renderer-owned big_value child config is applied in a second pass.
      for (const childField of field.fields) {
        fieldConfigs.set(childField.name, {
          ...resolveChildDisplayTags(childField),
          comparison: null,
          sparklineRef: null,
        });

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

      const tagConfig: BigValueTagConfig = {fieldConfigs, sparklineNestNames};

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

      for (const childField of field.fields) {
        const config = fieldConfigs.get(childField.name);
        if (!config) continue;
        Object.assign(config, resolveBigValueChildConfig(childField));
      }

      return pluginInstance;
    },
  };
