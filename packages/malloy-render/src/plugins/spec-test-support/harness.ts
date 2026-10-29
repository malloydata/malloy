/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Item, View} from 'vega';
import {API} from '@malloydata/malloy';
import {runtimeFor} from '../../../../../test/src/runtimes';
import {RenderFieldMetadata} from '@/render-field-metadata';
import {getDataTree, type RootField} from '@/data_tree';
import type {RepeatedRecordCell} from '@/data_tree';
import {
  getResultMetadata,
  type RenderMetadata,
} from '@/component/render-result-metadata';
import type {VegaChartProps} from '@/component/types';
import {MEASURE_SERIES_LABEL_SCALE} from '@/component/vega/measure-series-label-scale';

const duckdb = runtimeFor('duckdb');

export async function closeChartTestRuntime() {
  await duckdb.connection.close();
}

export interface ChartQueryResult {
  root: RootField;
  rootCell: RepeatedRecordCell;
  metadata: RenderMetadata;
}

/**
 * Runs a query, returning the data-tree root (`# label`s resolved), its data
 * cell, and the render metadata a spec generator consumes.
 */
export async function runChartQuery(
  source: string,
  query: string
): Promise<ChartQueryResult> {
  const result = await duckdb.loadModel(source).loadQuery(query).run();
  const malloyResult = API.util.wrapResult(result);
  const rfm = new RenderFieldMetadata(malloyResult);
  const rootCell = getDataTree(malloyResult, rfm);
  const root = rfm.getRootField();
  const metadata = getResultMetadata(root, {
    renderFieldMetadata: rfm,
    parentSize: {width: 400, height: 300},
  });
  return {root, rootCell, metadata};
}

/**
 * Builds the minimal scenegraph item shape getTooltipData reads. Real items
 * only exist inside a running vega View, which the node test env cannot load
 * (vega 6 is ESM-only), hence the cast at this third-party boundary.
 */
export function fakeTooltipItem(markName: string, datum: unknown): Item {
  return {datum, mark: {name: markName}} as unknown as Item;
}

export function fakeTooltipView(): View {
  return {scale: () => () => '#4285F4'} as unknown as View;
}

const DATA =
  'duckdb.sql("SELECT * FROM (VALUES ' +
  "('Total Universe (HH)', 75, '1Q26'), " +
  "('1Q26: High Income Earners', 28, '1Q26'), " +
  "('1Q26: Auto Intenders', 25, '2Q26')) " +
  'AS t(audience_name, reach, period)")';

export const SOURCE = `source: data is ${DATA}`;

const DATA4 =
  'duckdb.sql("SELECT * FROM (VALUES ' +
  "('Total Universe (HH)', 75, '1Q26', 'East'), " +
  "('1Q26: High Income Earners', 28, '1Q26', 'West'), " +
  "('1Q26: Auto Intenders', 25, '2Q26', 'East')) " +
  'AS t(audience_name, reach, period, region)")';

export const SOURCE4 = `source: data4 is ${DATA4}`;

const YOY_DATA =
  'duckdb.sql("SELECT * FROM (VALUES ' +
  "(DATE '2024-01-15', 10), (DATE '2024-04-15', 20), " +
  "(DATE '2025-01-15', 12), (DATE '2025-04-15', 24)) " +
  'AS t(event_date, sales)")';

export const YOY_SOURCE = `source: yoy_data is ${YOY_DATA}`;

/** The label-honoring cases shared by the bar and line chart specs. */
export function describeChartLabelTests(
  chartTag: 'bar_chart' | 'line_chart',
  buildProps: (source: string, query: string) => Promise<VegaChartProps>
) {
  afterAll(async () => {
    await closeChartTestRuntime();
  });

  describe(`${chartTag} honors # label tags on axis/legend titles`, () => {
    test('x and y axis titles use the # label tag, not the field name', async () => {
      const {spec} = await buildProps(
        SOURCE,
        `
        # ${chartTag}
        run: data -> {
          group_by:
            # label="Audience"
            audience_name
          aggregate:
            # label="Reach (HH)"
            total_reach is reach.sum()
        }
        `
      );
      const xAxis = spec.axes?.find(a => a.scale === 'xscale');
      const yAxis = spec.axes?.find(a => a.scale === 'yscale');
      expect(xAxis?.title).toBe('Audience');
      expect(yAxis?.title).toBe('Reach (HH)');
    }, 60000);

    test('legend title uses the # label tag of the series dimension', async () => {
      const {spec} = await buildProps(
        SOURCE,
        `
        # ${chartTag}
        run: data -> {
          group_by:
            # label="Audience"
            audience_name
            # label="Quarter"
            period
          aggregate:
            # label="Reach (HH)"
            total_reach is reach.sum()
        }
        `
      );
      expect(spec.legends?.[0]?.title).toBe('Quarter');
    }, 60000);

    test('measure-series legend entries use the # label tags, not field names', async () => {
      const {spec} = await buildProps(
        SOURCE,
        `
        # ${chartTag}
        run: data -> {
          group_by:
            # label="Audience"
            audience_name
          aggregate:
            # y
            # label="Reach (HH)"
            total_reach is reach.sum()
            # y
            # label=""
            avg_reach is reach.avg()
        }
        `
      );
      // Labels ride a data-driven scale, so an empty # label="" survives.
      const scale = (spec.scales ?? []).find(
        s => s.name === MEASURE_SERIES_LABEL_SCALE
      );
      const range = scale && 'range' in scale ? scale.range : undefined;
      const rangeArr: unknown[] = Array.isArray(range) ? range : [];
      expect(rangeArr).toContain('Reach (HH)');
      expect(rangeArr).toContain('');
      expect(rangeArr).not.toContain('avg_reach');
      expect(JSON.stringify(spec.legends?.[0] ?? {})).toContain(
        MEASURE_SERIES_LABEL_SCALE
      );
    }, 60000);
  });
}
