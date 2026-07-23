/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// The shared spec-test stub hard-codes isSpark:false, so it can't reach the
// sparkline branch. This file mocks chart-layout-settings as a spark layout to
// assert the y-scales disable `nice` (maximizing variation on tiny charts, as
// line_chart does). Real Vega can't load in this env (see harness), so this
// checks the generated spec directly.
jest.mock('@/component/chart/chart-layout-settings', () => ({
  getChartLayoutSettings: () => ({
    plotWidth: 180,
    plotHeight: 100,
    totalWidth: 180,
    totalHeight: 100,
    isSpark: true,
    padding: {top: 4, left: 0, right: 0, bottom: 4},
    xAxis: {labelAngle: 0, hidden: true},
    yAxis: {hidden: true, tickCount: 5, width: 0, yTitleSize: 0},
    // Spark: no precomputed domains and no secondary axis computed.
    yScale: {domain: null},
    y2Axis: undefined,
    y2Scale: undefined,
  }),
  getXAxisSettings: () => ({}),
}));
jest.mock('@/component/renderer/apply-renderer', () =>
  jest.requireActual('@/plugins/spec-test-support/apply-renderer-stub')
);
jest.mock('@/component/chart/chart-v2', () =>
  jest.requireActual('@/plugins/spec-test-support/chart-v2-stub')
);
jest.mock('vega', () => ({}));
jest.mock('vega-interpreter', () => ({}));
jest.mock('solid-js/jsx-runtime', () => ({}));

import {
  runChartQuery,
  closeChartTestRuntime,
  SOURCE,
} from '@/plugins/spec-test-support/harness';
import {getComboChartSettings} from '@/plugins/combo-chart/get-combo_chart-settings';
import {
  generateComboChartVegaSpec,
  type ComboChartSpecInputs,
} from '@/plugins/combo-chart/generate-combo_chart-vega-spec';

afterAll(async () => {
  await closeChartTestRuntime();
});

const TWO_MEASURES = `
  run: data -> {
    group_by: audience_name
    aggregate:
      total_reach is reach.sum()
      avg_reach is reach.avg()
  }
`;

test('spark size disables nice on both y-scales', async () => {
  const {root, metadata} = await runChartQuery(
    SOURCE,
    `# combo_chart ${TWO_MEASURES}`
  );
  const settings = getComboChartSettings(root);
  const plugin: ComboChartSpecInputs = {
    field: root,
    chartDisplay: {size: {preset: 'spark'}},
    getMetadata: () => ({type: 'combo', field: root, settings}),
  };
  const {spec} = generateComboChartVegaSpec(metadata, plugin);

  const yscale = spec.scales?.find(s => s.name === 'yscale') as {nice: boolean};
  const yscaleRight = spec.scales?.find(s => s.name === 'yscaleRight') as {
    nice: boolean;
  };
  expect(yscale.nice).toBe(false);
  expect(yscaleRight.nice).toBe(false);
}, 60000);
