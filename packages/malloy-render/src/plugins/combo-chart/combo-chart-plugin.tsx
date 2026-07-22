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
import {ChartV2} from '@/component/chart/chart-v2';
import {
  getComboChartSettings,
  type ComboChartSettings,
} from '@/plugins/combo-chart/get-combo_chart-settings';
import {generateComboChartVegaSpec} from '@/plugins/combo-chart/generate-combo_chart-vega-spec';
import {type VegaChartProps} from '@/component/types';
import {
  resolveChartDisplayConfig,
  type ChartDisplayConfig,
} from '@/component/chart/resolve-chart-display';
import {convertLegacyToVizTag} from '@/component/tag-utils';
import {type Config, parse, type Runtime} from 'vega';
import 'vega-interpreter';
import {mergeVegaConfigs} from '@/component/vega/merge-vega-configs';
import {baseVegaConfig} from '@/component/vega/base-vega-config';
import type {
  GetResultMetadataOptions,
  RenderMetadata,
} from '@/component/render-result-metadata';
import {
  defaultComboChartSettings,
  comboChartSettingsSchema,
} from './combo-chart-settings';
import {comboChartSettingsToTag} from './settings-to-tag';

export interface ComboChartPluginInstance extends CoreVizPluginInstance<ComboChartPluginMetadata> {
  field: NestField;
  chartDisplay: ChartDisplayConfig;
}

interface ComboChartPluginMetadata {
  type: 'combo';
  field: NestField;
  settings: ComboChartSettings;
}

export const ComboChartPluginFactory: RenderPluginFactory<ComboChartPluginInstance> =
  {
    name: 'combo',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'combo',
      ownedPaths: COMBO_CHART_TAG_PATHS,
      childOwnedPaths: [['tooltip']],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasComboChartTag = fieldTag.has('viz')
        ? fieldTag.text('viz') === 'combo'
        : fieldTag.has('combo_chart');
      const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;

      if (hasComboChartTag && !isRepeatedRecord) {
        throw new Error(
          'Malloy Combo Chart: field is a combo chart, but is not a repeated record. Try moving the tag to the line above the query, run, nest, or view declaration.'
        );
      }

      return hasComboChartTag && isRepeatedRecord;
    },

    create: (field: Field): ComboChartPluginInstance => {
      if (!field.isNest()) {
        throw new Error('Combo chart: must be a nest field');
      }

      let runtime: Runtime | undefined;
      let vegaProps: VegaChartProps | undefined;
      let useVegaInterpreter: boolean | undefined;
      let vegaConfig: Config | undefined;

      const settings = getComboChartSettings(field);

      const normalizedTag = convertLegacyToVizTag(field.tag);
      const vizTag = normalizedTag.tag('viz')!;
      const chartDisplay = resolveChartDisplayConfig(field, vizTag);

      const pluginInstance: ComboChartPluginInstance = {
        name: 'combo',
        field,
        renderMode: 'solidjs',
        sizingStrategy: 'fill',
        chartDisplay,

        renderComponent: (props: RenderProps): JSXElement => {
          if (!runtime || !vegaProps) {
            throw new Error('Malloy Combo Chart: missing Vega runtime');
          }
          if (!props.dataColumn.isRepeatedRecord()) {
            throw new Error(
              'Malloy Combo Chart: data column is not a repeated record'
            );
          }

          const mappedData = vegaProps.mapMalloyDataToChartData(
            props.dataColumn
          );

          return (
            <ChartV2
              data={props.dataColumn}
              values={mappedData.data}
              runtime={runtime}
              vegaSpec={vegaProps.spec}
              plotWidth={vegaProps.plotWidth}
              plotHeight={vegaProps.plotHeight}
              totalWidth={vegaProps.totalWidth}
              totalHeight={vegaProps.totalHeight}
              title={vegaProps.title}
              subtitle={vegaProps.subtitle}
              getTooltipData={vegaProps.getTooltipData}
              isDataLimited={mappedData.isDataLimited}
              dataLimitMessage={mappedData.dataLimitMessage}
              useVegaInterpreter={useVegaInterpreter}
            />
          );
        },

        beforeRender: (
          renderMetadata: RenderMetadata,
          options: GetResultMetadataOptions
        ): void => {
          useVegaInterpreter = options.useVegaInterpreter;

          vegaConfig = mergeVegaConfigs(
            baseVegaConfig(),
            options.getVegaConfigOverride?.('combo_chart') ?? {}
          );

          vegaProps = generateComboChartVegaSpec(
            renderMetadata,
            pluginInstance,
            vegaConfig
          );

          const parseOptions = options.useVegaInterpreter
            ? {ast: true}
            : undefined;
          runtime = parse(vegaProps.spec, vegaConfig, parseOptions);
        },

        getMetadata: (): ComboChartPluginMetadata => ({
          type: 'combo',
          field,
          settings,
        }),

        getSchema: () => comboChartSettingsSchema,
        getSettings: () => settings,
        getDefaultSettings: () => defaultComboChartSettings,
        settingsToTag: (settings: Record<string, unknown>) => {
          return comboChartSettingsToTag(settings as ComboChartSettings);
        },

        getStyleOverrides: (): Record<string, string> => {
          if (vegaConfig?.background) {
            return {
              '--malloy-render--background': vegaConfig.background as string,
            };
          }
          return {};
        },
      };

      return pluginInstance;
    },
  };

/**
 * Tag paths read by the combo chart plugin during render/interaction.
 * Declared so the framework can mark them as read at registration time,
 * preventing false-positive unread-tag warnings.
 */
const COMBO_CHART_TAG_PATHS: string[][] = [
  // Legacy tag form (read by convertLegacyToVizTag)
  ['combo_chart'],
];
