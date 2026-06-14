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
  SOURCE4,
} from '@/plugins/spec-test-support/harness';
import {generateScatterChartSpec} from '@/plugins/scatter-chart/generate-scatter_chart-spec';

afterAll(async () => {
  await closeChartTestRuntime();
});

describe('scatter_chart honors # label tags on channel titles', () => {
  test('x/y axis and color/size/shape legend titles use the # label tags', async () => {
    const {root, rootCell} = await runChartQuery(
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
    const compiled = lite.compile(generateScatterChartSpec(rootCell, root), {
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
