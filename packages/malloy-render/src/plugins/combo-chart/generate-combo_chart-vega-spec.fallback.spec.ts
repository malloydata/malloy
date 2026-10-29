/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Regression guard for the y-scale domain fallback. The shared spec test uses a
// stub that always supplies a precomputed domain, so it can never reach the
// `?? {data, field}` fallback branch — which is exactly where two documented,
// reachable cases (`size=spark` and `.independent`) end up. This file mocks
// chart-layout-settings to reproduce those cases (undefined y2Scale, null
// yScale.domain) and asserts the fallback reads a field that actually exists on
// the folded per-axis datasets. Real Vega can't load in this env (see harness),
// so this checks the generated spec directly rather than parsing it.
jest.mock('@/component/chart/chart-layout-settings', () => ({
  getChartLayoutSettings: () => ({
    plotWidth: 300,
    plotHeight: 200,
    totalWidth: 400,
    totalHeight: 300,
    isSpark: false,
    padding: {top: 0, left: 0, right: 0, bottom: 0},
    xAxis: {labelAngle: 0, hidden: false},
    yAxis: {hidden: false, tickCount: 5, width: 40, yTitleSize: 12},
    // null domain = `.independent` (left axis); undefined y2Scale/y2Axis =
    // `size=spark` (no secondary axis computed). Both hit the fallback.
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
import type {Data} from 'vega';
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

test('scale domain fallback reads the folded datasets, not absent fields on values', async () => {
  const {root, metadata} = await runChartQuery(
    SOURCE,
    `# combo_chart ${TWO_MEASURES}`
  );
  const settings = getComboChartSettings(root);
  const plugin: ComboChartSpecInputs = {
    field: root,
    chartDisplay: {size: {}},
    getMetadata: () => ({type: 'combo', field: root, settings}),
  };
  const {spec} = generateComboChartVegaSpec(metadata, plugin);

  const yscale = spec.scales?.find(s => s.name === 'yscale');
  const yscaleRight = spec.scales?.find(s => s.name === 'yscaleRight');

  // The fallback must point at the folded per-axis datasets (field `y`), which
  // exist — not `{data:'values', field:'yLeft'/'yRight'}`, which never do.
  expect(yscale?.domain).toEqual({data: 'left_values', field: 'y'});
  expect(yscaleRight?.domain).toEqual({data: 'right_values', field: 'y'});

  // And confirm those datasets are actually defined and fold a `y` field.
  const datasets = (spec.data ?? []) as Data[];
  for (const name of ['left_values', 'right_values']) {
    const ds = datasets.find(d => d.name === name);
    expect(ds).toBeDefined();
    const foldsToY = (ds?.transform ?? []).some(
      t => t.type === 'fold' && (t.as ?? [])[1] === 'y'
    );
    expect(foldsToY).toBe(true);
  }
}, 60000);
