/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  NestField,
  NestCell,
  RenderPlugin,
  RenderPluginInstance,
} from '../data_tree';
import {RepeatedRecordCell, RecordCell, FieldType} from '../data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import {getLineChartSettings} from '../component/line-chart/get-line_chart-settings';
import {NULL_SYMBOL} from '../util';
interface SeriesStats {
  sum: number;
  count: number;
  avg: number;
}

type LineChartPluginInstance = {
  getTopNSeries: (n: number) => (string | number | boolean)[];
} & RenderPluginInstance;

export const LineChartSeriesPluginFactory: RenderPlugin<LineChartPluginInstance> =
  {
    name: 'line_chart_series',
    matches: (fieldTag: Tag, fieldType: FieldType): boolean => {
      return (
        (fieldTag.has('line_chart') || fieldTag.text('viz') === 'line') &&
        fieldType === FieldType.RepeatedRecord
      );
    },
    plugin: field => {
      const name = 'line_chart_series';
      const matches = (fieldTag: Tag, fieldType: FieldType): boolean => {
        return (
          (fieldTag.has('line_chart') || fieldTag.text('viz') === 'line') &&
          fieldType === FieldType.RepeatedRecord
        );
      };
      try {
        if (!field.isNest()) {
          throw new Error('Line chart: must be a nest field');
        }
        const chartSettings = getLineChartSettings(field);
        const globalSeriesStats = new Map<string, SeriesStats>();
        const yField = field.fieldAt(chartSettings.yChannel.fields[0]);
        const maybeSeriesFieldPath = chartSettings.seriesChannel.fields[0];
        const seriesField = maybeSeriesFieldPath
          ? field.fieldAt(maybeSeriesFieldPath)
          : null;
        if (!yField) {
          throw new Error(
            'Line chart: missing a y field. Did you add an aggregation?'
          );
        }

        const processData = (field: NestField, cell: NestCell): void => {
          let rows: RecordCell[];
          if (cell instanceof RepeatedRecordCell) {
            rows = cell.rows;
          } else if (cell instanceof RecordCell) {
            rows = [cell];
          } else {
            return; // Skip if not a record cell
          }

          // Process all rows in this cell, aggregating by series value
          for (const row of rows) {
            if (seriesField) {
              const seriesValue =
                row.column(seriesField.name).value ?? NULL_SYMBOL;
              const yValue = row.column(yField.name).value;
              const stats = globalSeriesStats.get(seriesValue) ?? {
                sum: 0,
                count: 0,
                avg: 0,
              };
              stats.sum += yValue;
              stats.count += 1;
              stats.avg = stats.sum / stats.count;
              globalSeriesStats.set(seriesValue, stats);
            }
          }
        };

        const getTopNSeries = (n: number): (string | number | boolean)[] => {
          // TODO make configurable from tag
          const rankType = 'sum';
          const data = globalSeriesStats;
          if (!data) {
            return [];
          }

          return Array.from(globalSeriesStats.entries())
            .sort((a, b) => b[1][rankType] - a[1][rankType])
            .slice(0, n)
            .map(entry => entry[0]);
        };

        return {
          name,
          matches,
          processData,
          getTopNSeries,
        } as LineChartPluginInstance;
      } catch (err) {
        return {
          name,
          matches,
          processData: () => {},
          getTopNSeries: () => [],
        };
      }
    },
  };

export type LineChartSeriesPluginInstance = ReturnType<
  typeof LineChartSeriesPluginFactory.plugin
>;
