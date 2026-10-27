/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The builder reaches ESM-only vega through @/html/vega_spec but never calls it.
jest.mock('vega', () => ({}));

import * as lite from 'vega-lite';
import type {LoggerInterface} from 'vega';
import {
  runChartQuery,
  closeChartTestRuntime,
  fakeTooltipItem,
  SOURCE4,
} from '@/plugins/spec-test-support/harness';
import {
  generateScatterChartSpec,
  mapScatterRow,
  scatterTooltip,
} from '@/plugins/scatter-chart/generate-scatter_chart-spec';
import {rowOfMark} from '@/component/vega/vega-lite-spec';
import {CATEGORY_PALETTE} from '@/component/vega/base-vega-config';

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

describe('scatter_chart draws live, in the theme colors, with a tooltip', () => {
  const QUERY = `
    # scatter_chart
    run: data4 -> {
      group_by: audience_name
      aggregate:
        # label="Reach (HH)" currency
        total_reach is reach.sum()
      group_by: region
    }
  `;

  test('its rows come from the live values data source', async () => {
    const {root} = await runChartQuery(SOURCE4, QUERY);
    expect(generateScatterChartSpec(root).data).toEqual({name: 'values'});
  });

  const colorOf = (spec: lite.TopLevelSpec) =>
    'encoding' in spec ? spec.encoding?.color : undefined;

  test("without a color field, points take the theme's first color", async () => {
    const {root} = await runChartQuery(
      SOURCE4,
      'run: data4 -> { group_by: audience_name; aggregate: total_reach is reach.sum() }'
    );
    expect(colorOf(generateScatterChartSpec(root))).toEqual({
      value: CATEGORY_PALETTE[0],
    });
    expect(
      colorOf(generateScatterChartSpec(root, {range: {category: ['#123456']}}))
    ).toEqual({value: '#123456'});
  });

  test("a text color field takes the theme's series colors", async () => {
    const {root} = await runChartQuery(SOURCE4, QUERY);
    expect(colorOf(generateScatterChartSpec(root))).toMatchObject({
      field: 'region',
      scale: {range: [...CATEGORY_PALETTE]},
    });
    expect(
      colorOf(generateScatterChartSpec(root, {range: {category: ['#123456']}}))
    ).toMatchObject({scale: {range: ['#123456']}});
  });

  test('the tooltip labels and formats each column the chart draws', async () => {
    const {root, rootCell} = await runChartQuery(SOURCE4, QUERY);
    const row = rootCell.rows.find(
      r => r.column('audience_name').value === 'Total Universe (HH)'
    );
    if (row === undefined) throw new Error('missing row');
    expect(scatterTooltip(root)(row)).toEqual({
      title: [],
      entries: [
        {
          label: 'audience_name',
          value: 'Total Universe (HH)',
          highlight: false,
          entryType: 'list-item',
        },
        {
          label: 'Reach (HH)',
          value: '$75.00',
          highlight: false,
          entryType: 'list-item',
        },
        {
          label: 'region',
          value: 'East',
          highlight: false,
          entryType: 'list-item',
        },
      ],
    });
  });

  test('a mark finds the row it was drawn from; a background mark finds none', async () => {
    const {rootCell} = await runChartQuery(SOURCE4, QUERY);
    const row = rootCell.rows[0];
    const datum = {...mapScatterRow(row, undefined), __row: row};
    expect(rowOfMark(fakeTooltipItem('marks', datum))).toBe(row);
    expect(rowOfMark(fakeTooltipItem('marks', {id: '06'}))).toBeUndefined();
  });
});
