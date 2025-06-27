import type {
  RenderPluginFactory,
  RenderProps,
  CoreVizPluginInstance,
} from '@/api/plugin-types';
import {type Field, FieldType, type NestField} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import type {JSXElement} from 'solid-js';
import {ChartV2} from '@/component/chart/chart-v2';
import {
  getWaterfallChartSettings,
  type WaterfallChartSettings,
} from './get-waterfall_chart-settings';
import {generateWaterfallChartVegaSpec} from './generate-waterfall_chart-vega-spec';
import {type VegaChartProps} from '@/component/types';
import {type Config, parse, type Runtime} from 'vega';
import {mergeVegaConfigs} from '@/component/vega/merge-vega-configs';
import {baseVegaConfig} from '@/component/vega/base-vega-config';
import type {
  GetResultMetadataOptions,
  RenderMetadata,
} from '@/component/render-result-metadata';
import {
  defaultWaterfallChartSettings,
  waterfallChartSettingsSchema,
} from './waterfall-chart-settings';
import {waterfallChartSettingsToTag} from './settings-to-tag';

interface WaterfallChartPluginMetadata {
  type: 'waterfall';
  field: NestField;
  settings: WaterfallChartSettings;
}

export interface WaterfallChartPluginInstance
  extends CoreVizPluginInstance<WaterfallChartPluginMetadata> {
  field: NestField;
}

export const WaterfallChartPluginFactory: RenderPluginFactory<WaterfallChartPluginInstance> = {
  name: 'waterfall',

  matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
    const hasTag = fieldTag.has('viz') && fieldTag.text('viz') === 'waterfall';
    const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;
    if (hasTag && !isRepeatedRecord) {
      throw new Error(
        'Malloy Waterfall Chart: field is a waterfall chart, but is not a repeated record'
      );
    }
    return hasTag && isRepeatedRecord;
  },

  create: (field: Field): WaterfallChartPluginInstance => {
    if (!field.isNest()) {
      throw new Error('Waterfall chart: must be a nest field');
    }

    let settings: WaterfallChartSettings;
    let runtime: Runtime | undefined;
    let vegaProps: VegaChartProps | undefined;

    try {
      settings = getWaterfallChartSettings(field);
    } catch (error) {
      throw new Error(`Waterfall chart settings error: ${error.message}`);
    }

    const pluginInstance: WaterfallChartPluginInstance = {
      name: 'waterfall',
      field,
      renderMode: 'solidjs',
      sizingStrategy: 'fill',

      renderComponent: (props: RenderProps): JSXElement => {
        if (!runtime || !vegaProps) {
          throw new Error('Malloy Waterfall Chart: missing Vega runtime');
        }
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('Malloy Waterfall Chart: data column is not a repeated record');
        }

        const mappedData = vegaProps.mapMalloyDataToChartData(props.dataColumn);

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
            chartTag={vegaProps.chartTag}
            isDataLimited={mappedData.isDataLimited}
            dataLimitMessage={mappedData.dataLimitMessage}
          />
        );
      },

      beforeRender: (
        metadata: RenderMetadata,
        options: GetResultMetadataOptions
      ): void => {
        vegaProps = generateWaterfallChartVegaSpec(metadata, pluginInstance);
        const vegaConfig: Config = mergeVegaConfigs(
          baseVegaConfig(),
          options.getVegaConfigOverride?.('waterfall') ?? {}
        );
        runtime = parse(vegaProps.spec, vegaConfig);
      },

      getMetadata: (): WaterfallChartPluginMetadata => ({
        type: 'waterfall',
        field,
        settings,
      }),

      getSchema: () => waterfallChartSettingsSchema,
      getSettings: () => settings,
      getDefaultSettings: () => defaultWaterfallChartSettings,
      settingsToTag: (settings: Record<string, unknown>) => {
        return waterfallChartSettingsToTag(settings as WaterfallChartSettings);
      },
    };

    return pluginInstance;
  },
};

export type {WaterfallChartPluginInstance};
