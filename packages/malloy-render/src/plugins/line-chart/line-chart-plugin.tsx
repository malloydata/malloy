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
  getLineChartSettings,
  type LineChartSettings,
  type LineChartPluginOptions,
} from '@/plugins/line-chart/get-line_chart-settings';
import {generateLineChartVegaSpecV2} from '@/plugins/line-chart/generate-line_chart-vega-spec';
import {type VegaChartProps} from '@/component/types';
import {type Config, parse, type Runtime} from 'vega';
import {mergeVegaConfigs} from '@/component/vega/merge-vega-configs';
import {baseVegaConfig} from '@/component/vega/base-vega-config';
import {NULL_SYMBOL} from '@/util';
import type {
  GetResultMetadataOptions,
  RenderMetadata,
} from '@/component/render-result-metadata';
import {
  defaultLineChartSettings,
  lineChartSettingsSchema,
} from './line-chart-settings';
import {lineChartSettingsToTag} from './settings-to-tag';

interface LineChartPluginMetadata {
  type: 'line';
  field: NestField;
  settings: LineChartSettings;
}

interface SeriesStats {
  sum: number;
  count: number;
  avg: number;
}

interface LineChartPluginInstance
  extends CoreVizPluginInstance<LineChartPluginMetadata> {
  field: NestField;
  seriesStats: Map<string, SeriesStats>;
  getTopNSeries: (maxSeries: number) => (string | number | boolean)[];
  syntheticSeriesField?: Field;
}

export const LineChartPluginFactory: RenderPluginFactory<LineChartPluginInstance> =
  {
    name: 'line',

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      // Match repeated record fields with line chart tags
      const hasLineChartTag = fieldTag.has('viz')
        ? fieldTag.text('viz') === 'line'
        : fieldTag.has('line_chart');

      const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;

      if (hasLineChartTag && !isRepeatedRecord) {
        throw new Error(
          'Malloy Line Chart: field is a line chart, but is not a repeated record'
        );
      }

      return hasLineChartTag && isRepeatedRecord;
    },

    create: (
      field: Field,
      pluginOptions?: unknown,
      modelTag?: Tag
    ): LineChartPluginInstance => {
      if (!field.isNest()) {
        throw new Error('Line chart: must be a nest field');
      }

      const lineChartOptions = pluginOptions as
        | LineChartPluginOptions
        | undefined;
      let settings: LineChartSettings;
      const seriesStats = new Map<string, SeriesStats>();
      let runtime: Runtime | undefined;
      let vegaProps: VegaChartProps | undefined;

      try {
        settings = getLineChartSettings(
          field,
          undefined,
          lineChartOptions?.defaults,
          modelTag
        );
      } catch (error) {
        throw new Error(`Line chart settings error: ${error.message}`);
      }

      const pluginInstance: LineChartPluginInstance = {
        name: 'line',
        field,
        renderMode: 'solidjs',
        sizingStrategy: 'fill',
        seriesStats,

        renderComponent: (props: RenderProps): JSXElement => {
          if (!runtime || !vegaProps) {
            throw new Error('Malloy Line Chart: missing Vega runtime');
          }
          if (!props.dataColumn.isRepeatedRecord()) {
            throw new Error(
              'Malloy Line Chart: data column is not a repeated record'
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
            />
          );
        },

        processData: (field, cell): void => {
          // Process all rows to calculate series stats
          if (!('rows' in cell)) return; // Only process RepeatedRecordCell

          const yFieldPath = settings.yChannel.fields[0];
          if (!yFieldPath) return;
          const yField = field.fieldAt(yFieldPath);
          if (!yField) return;

          // Handle YoY mode - create synthetic series field for years
          if (settings.mode === 'yoy') {
            const xFieldPath = settings.xChannel.fields[0];
            if (!xFieldPath) return;
            const xField = field.fieldAt(xFieldPath);
            if (!xField || !(xField.isDate() || xField.isTime())) return;

            const yearValues = new Set<string>();

            // Extract years from the data
            for (const row of cell.rows) {
              const xCell = row.column(xField.name);
              const year = new Date(xCell.value.valueOf())
                .getFullYear()
                .toString();
              yearValues.add(year);
            }

            // Create synthetic series field
            pluginInstance.syntheticSeriesField = {
              name: 'Year',
              valueSet: yearValues,
              referenceId: '__synthetic_year__',
              // Add minimal Field interface properties that might be used
              isTime: () => false,
              isDate: () => false,
              isBasic: () => true,
              isNumber: () => false,
              isString: () => true,
              isBoolean: () => false,
            } as unknown as Field;

            // Calculate series stats for YoY mode
            for (const row of cell.rows) {
              const year = new Date(row.column(xField.name).value.valueOf())
                .getFullYear()
                .toString();
              const yValue = row.column(yField.name).value;

              if (typeof yValue === 'number') {
                const stats = seriesStats.get(year) ?? {
                  sum: 0,
                  count: 0,
                  avg: 0,
                };
                stats.sum += yValue;
                stats.count += 1;
                stats.avg = stats.sum / stats.count;
                seriesStats.set(year, stats);
              }
            }
          } else {
            // Normal mode - use actual series field
            const seriesFieldPath = settings.seriesChannel.fields[0];
            if (!seriesFieldPath) return;

            const seriesField = field.fieldAt(seriesFieldPath);
            if (!seriesField) return;

            for (const row of cell.rows) {
              const seriesValue =
                row.column(seriesField.name).value ?? NULL_SYMBOL;
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
          }
        },

        beforeRender: (
          metadata: RenderMetadata,
          options: GetResultMetadataOptions
        ): void => {
          vegaProps = generateLineChartVegaSpecV2(metadata, pluginInstance);

          // TODO: should this be passed as plugin options? createLineChartPlugin(options)?
          // but how would you supply these options to the default plugins?
          const vegaConfigOverride =
            options.getVegaConfigOverride?.('line_chart') ?? {};

          const vegaConfig: Config = mergeVegaConfigs(
            baseVegaConfig(),
            options.getVegaConfigOverride?.('line_chart') ?? {}
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

          runtime = parse(vegaProps.spec, vegaConfig);
        },

        getMetadata: (): LineChartPluginMetadata => ({
          type: 'line',
          field,
          settings,
        }),

        getSchema: () => lineChartSettingsSchema,
        getSettings: () => settings,
        getDefaultSettings: () => defaultLineChartSettings,
        settingsToTag: (settings: Record<string, unknown>) => {
          return lineChartSettingsToTag(settings as LineChartSettings);
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

export type {LineChartPluginInstance};
