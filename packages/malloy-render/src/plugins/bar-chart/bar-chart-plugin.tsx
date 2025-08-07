/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
  getBarChartSettings,
  type BarChartSettings,
} from '@/plugins/bar-chart/get-bar_chart-settings';
import {generateBarChartVegaSpecV2} from '@/plugins/bar-chart/generate-bar_chart-vega-spec';
import {type VegaChartProps} from '@/component/types';
import {type Config, parse, type Runtime} from 'vega';
import 'vega-interpreter';
import {mergeVegaConfigs} from '@/component/vega/merge-vega-configs';
import {baseVegaConfig} from '@/component/vega/base-vega-config';
import {NULL_SYMBOL} from '@/util';
import type {
  GetResultMetadataOptions,
  RenderMetadata,
} from '@/component/render-result-metadata';
import {
  defaultBarChartSettings,
  barChartSettingsSchema,
} from './bar-chart-settings';
import {barChartSettingsToTag} from './settings-to-tag';

export interface BarChartPluginInstance
  extends CoreVizPluginInstance<BarChartPluginMetadata> {
  getTopNSeries?: (maxSeries: number) => (string | number | boolean)[];
  field: NestField;
  syntheticSeriesField?: Field;
  hasMultipleSeriesFields?: boolean;
}

interface BarChartPluginMetadata {
  type: 'bar';
  field: NestField;
  settings: BarChartSettings;
}

interface SeriesStats {
  sum: number;
  count: number;
  avg: number;
}

export const BarChartPluginFactory: RenderPluginFactory<BarChartPluginInstance> =
  {
    name: 'bar',

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      // Match repeated record fields with bar chart tags
      const hasBarChartTag = fieldTag.has('viz')
        ? fieldTag.text('viz') === 'bar'
        : fieldTag.has('bar_chart');
      const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;

      if (hasBarChartTag && !isRepeatedRecord) {
        throw new Error(
          'Malloy Bar Chart: field is a bar chart, but is not a repeated record'
        );
      }

      return hasBarChartTag && isRepeatedRecord;
    },

    create: (field: Field): BarChartPluginInstance => {
      if (!field.isNest()) {
        throw new Error('Bar chart: must be a nest field');
      }

      const seriesStats = new Map<string, SeriesStats>();
      let runtime: Runtime | undefined;
      let vegaProps: VegaChartProps | undefined;
      let useVegaInterpreter: boolean | undefined;

      const settings = getBarChartSettings(field);
      const hasMultipleSeriesFields = settings.seriesChannel.fields.length > 1;

      const pluginInstance: BarChartPluginInstance = {
        name: 'bar',
        field,
        renderMode: 'solidjs',
        sizingStrategy: 'fill',
        hasMultipleSeriesFields,

        renderComponent: (props: RenderProps): JSXElement => {
          if (!runtime || !vegaProps) {
            throw new Error('Malloy Bar Chart: missing Vega runtime');
          }
          if (!props.dataColumn.isRepeatedRecord()) {
            throw new Error(
              'Malloy Bar Chart: data column is not a repeated record'
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
              chartTag={vegaProps.chartTag}
              getTooltipData={vegaProps.getTooltipData}
              isDataLimited={mappedData.isDataLimited}
              dataLimitMessage={mappedData.dataLimitMessage}
              useVegaInterpreter={useVegaInterpreter}
            />
          );
        },

        processData: (field, cell): void => {
          // Calculate series statistics for series limiting
          const yFieldPath = settings.yChannel.fields[0];
          const seriesFieldPaths = settings.seriesChannel.fields;

          if (!yFieldPath || seriesFieldPaths.length === 0) return;

          const yField = field.fieldAt(yFieldPath);
          const seriesFields = seriesFieldPaths.map(path =>
            field.fieldAt(path)
          );
          if (!yField || seriesFields.some(f => !f)) return;

          // Process all rows to calculate series stats (unified logic)
          if (!('rows' in cell)) return; // Only process RepeatedRecordCell

          const concatenatedValues = new Set<string>();
          for (const row of cell.rows) {
            // CONDITIONAL: Only the series value extraction differs
            const seriesValue = hasMultipleSeriesFields
              ? seriesFields
                  .map(
                    seriesField =>
                      row.column(seriesField.name).value ?? NULL_SYMBOL
                  )
                  .join(' - ')
              : row.column(seriesFields[0].name).value ?? NULL_SYMBOL;

            if (hasMultipleSeriesFields) {
              concatenatedValues.add(seriesValue);
            }

            const yValue = row.column(yField.name).value;

            if (typeof yValue === 'number') {
              const stats = seriesStats.get(seriesValue) ?? {
                sum: 0,
                count: 0,
                avg: 0,
              };
              stats.sum += yValue;
              stats.count += 1;
              stats.avg = stats.sum / stats.count;
              seriesStats.set(seriesValue, stats);
            }
          }

          if (hasMultipleSeriesFields) {
            // Create synthetic field
            pluginInstance.syntheticSeriesField = {
              name: seriesFields.map(f => f.name).join(' - '),
              valueSet: concatenatedValues,
              referenceId: '__synthetic_concatenated_series__',
              // Minimal Field interface implementation
              isTime: () => false,
              isDate: () => false,
              isBasic: () => true,
              isNumber: () => false,
              isString: () => true,
              isBoolean: () => false,
            } as unknown as Field;
          }
        },

        beforeRender: (
          metadata: RenderMetadata,
          options: GetResultMetadataOptions
        ): void => {
          vegaProps = generateBarChartVegaSpecV2(metadata, pluginInstance);
          useVegaInterpreter = options.useVegaInterpreter;

          const vegaConfigOverride =
            options.getVegaConfigOverride?.('bar_chart') ?? {};

          const vegaConfig: Config = mergeVegaConfigs(
            baseVegaConfig(),
            options.getVegaConfigOverride?.('bar_chart') ?? {}
          );

          const maybeAxisYLabelFont =
            vegaConfigOverride['axisY']?.['labelFont'];
          const maybeAxisLabelFont = vegaConfigOverride['axis']?.['labelFont'];
          if (maybeAxisYLabelFont || maybeAxisLabelFont) {
            const refLineFontSignal = vegaConfig.signals?.find(
              signal => signal.name === 'referenceLineFont'
            );
            if (refLineFontSignal)
              refLineFontSignal.value =
                maybeAxisYLabelFont ?? maybeAxisLabelFont;
          }

          // Use vega-interpreter if specified
          const parseOptions = options.useVegaInterpreter
            ? {ast: true}
            : undefined;
          runtime = parse(vegaProps.spec, vegaConfig, parseOptions);
        },

        getMetadata: (): BarChartPluginMetadata => ({
          type: 'bar',
          field,
          settings,
        }),

        getSchema: () => barChartSettingsSchema,
        getSettings: () => settings,
        getDefaultSettings: () => defaultBarChartSettings,
        settingsToTag: (settings: Record<string, unknown>) => {
          return barChartSettingsToTag(settings as BarChartSettings);
        },

        getTopNSeries: (maxSeries: number) => {
          return Array.from(seriesStats.entries())
            .sort((a, b) => b[1].sum - a[1].sum)
            .slice(0, maxSeries)
            .map(entry => entry[0]);
        },
      };

      return pluginInstance;
    },
  };
