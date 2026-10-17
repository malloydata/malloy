/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The builder reaches ESM-only vega through @/html/vega_spec but never calls it.
jest.mock('vega', () => ({}));
jest.mock('vega-interpreter', () => ({}));
jest.mock('solid-js/jsx-runtime', () => ({}));
jest.mock('@/component/chart/chart-v2', () =>
  jest.requireActual('@/plugins/spec-test-support/chart-v2-stub')
);
jest.mock('@/component/renderer/apply-renderer', () =>
  jest.requireActual('@/plugins/spec-test-support/apply-renderer-stub')
);

import * as lite from 'vega-lite';
import type {LoggerInterface} from 'vega';
import {
  runChartQuery,
  closeChartTestRuntime,
  SOURCE4,
} from '@/plugins/spec-test-support/harness';
import {
  generateScatterChartSpec,
  mapScatterRow,
} from '@/plugins/scatter-chart/generate-scatter_chart-spec';
import {rowTooltip} from '@/component/vega/vega-lite-chart';
import {baseVegaConfig} from '@/component/vega/base-vega-config';
import type {Item} from 'vega';

afterAll(async () => {
  await closeChartTestRuntime();
});

describe('scatter_chart honors # label tags on channel titles', () => {
  test('x/y axis and color/size/shape legend titles use the # label tags', async () => {
    const {root} = await runChartQuery(
      SOURCE4,
      `
      # scatter_chart
      run: data4 -> {
        group_by:
          # label="Audience"
          audience_name
        aggregate:
          # label="Reach (HH)"
          total_reach is reach.sum()
        group_by:
          # label="Quarter"
          period
        aggregate:
          # label="Avg Reach"
          avg_reach is reach.avg()
        group_by:
          # label="Region"
          region
      }
      `
    );
    // Quiet logger: the spec's pre-existing `zero: false` on a nominal x
    // channel makes vega-lite warn that zero is dropped for point scales.
    const quietLogger = {
      level() {
        return this;
      },
      error() {
        return this;
      },
      warn() {
        return this;
      },
      info() {
        return this;
      },
      debug() {
        return this;
      },
    } as unknown as LoggerInterface;
    const compiled = lite.compile(generateScatterChartSpec(root), {
      logger: quietLogger,
    }).spec;

    const axisTitle = (scaleName: string) =>
      (compiled.axes ?? []).find(a => a.scale === scaleName && a.title)?.title;
    expect(axisTitle('x')).toBe('Audience');
    expect(axisTitle('y')).toBe('Reach (HH)');

    const legendTitles = (compiled.legends ?? []).map(l => l.title);
    expect(legendTitles).toContain('Quarter');
    expect(legendTitles).toContain('Avg Reach');
    expect(legendTitles).toContain('Region');

    const allTitles = [
      ...(compiled.axes ?? []).map(a => a.title),
      ...legendTitles,
    ];
    for (const rawName of [
      'audience_name',
      'total_reach',
      'period',
      'avg_reach',
      'region',
    ]) {
      expect(allTitles).not.toContain(rawName);
    }
  }, 60000);
});

describe('scatter_chart draws live, in the theme color, with a row tooltip', () => {
  const QUERY = `
    # scatter_chart
    run: data4 -> {
      group_by: audience_name
      aggregate:
        # label="Reach (HH)"
        total_reach is reach.sum()
    }
  `;

  test('its rows come from the live values data source', async () => {
    const {root} = await runChartQuery(SOURCE4, QUERY);
    expect(generateScatterChartSpec(root).data).toEqual({name: 'values'});
  });

  const colorOf = (spec: lite.TopLevelSpec) =>
    (spec as {encoding?: {color?: unknown}}).encoding?.color;

  test("without a color field, points take the theme's first color", async () => {
    const {root} = await runChartQuery(SOURCE4, QUERY);
    const palette = baseVegaConfig().range!.category as string[];
    expect(colorOf(generateScatterChartSpec(root))).toEqual({
      value: palette[0],
    });
    expect(
      colorOf(generateScatterChartSpec(root, {range: {category: ['#123456']}}))
    ).toEqual({value: '#123456'});
  });

  test('the tooltip titles the row and formats each other column', async () => {
    const {root, rootCell} = await runChartQuery(SOURCE4, QUERY);
    const row = rootCell.rows[0];
    const datum = {...mapScatterRow(row, undefined), __row: row};
    const tip = rowTooltip({datum} as unknown as Item);
    expect(tip).toEqual({
      title: [row.column('audience_name').value],
      entries: [
        {
          label: 'Reach (HH)',
          value: String(row.column('total_reach').value),
          highlight: false,
          entryType: 'list-item',
        },
      ],
    });
    expect(root.fields.map(f => f.name)).toEqual([
      'audience_name',
      'total_reach',
    ]);
  });

  test('a mark not drawn from a row has no tooltip', () => {
    expect(rowTooltip({datum: {id: '06'}} as unknown as Item)).toBeNull();
  });
});
