/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// These modules do not load under the node test env; the stubs document why.
jest.mock('@/component/chart/chart-layout-settings', () =>
  jest.requireActual('@/plugins/spec-test-support/chart-layout-settings-stub')
);
jest.mock('@/component/bar-chart/get-custom-tooltips-entries', () =>
  jest.requireActual(
    '@/plugins/spec-test-support/get-custom-tooltips-entries-stub'
  )
);

import type {Spec} from 'vega';
import {
  describeChartLabelTests,
  runChartQuery,
} from '@/plugins/spec-test-support/harness';
import {getBarChartSettings} from '@/plugins/bar-chart/get-bar_chart-settings';
import {
  generateBarChartVegaSpecV2,
  type BarChartSpecInputs,
} from '@/plugins/bar-chart/generate-bar_chart-vega-spec';

async function buildBarSpec(source: string, query: string): Promise<Spec> {
  const {root, metadata} = await runChartQuery(source, query);
  const settings = getBarChartSettings(root);
  const plugin: BarChartSpecInputs = {
    field: root,
    chartDisplay: {size: {}},
    getMetadata: () => ({type: 'bar', field: root, settings}),
  };
  return generateBarChartVegaSpecV2(metadata, plugin).spec;
}

describeChartLabelTests('bar_chart', buildBarSpec);
