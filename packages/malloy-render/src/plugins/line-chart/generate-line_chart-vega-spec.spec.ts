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
import {getLineChartSettings} from '@/plugins/line-chart/get-line_chart-settings';
import {
  generateLineChartVegaSpecV2,
  type LineChartSpecInputs,
} from '@/plugins/line-chart/generate-line_chart-vega-spec';

async function buildLineSpec(source: string, query: string): Promise<Spec> {
  const {root, metadata} = await runChartQuery(source, query);
  const settings = getLineChartSettings(root);
  const plugin: LineChartSpecInputs = {
    field: root,
    chartDisplay: {size: {}},
    getTopNSeries: () => [],
    getMetadata: () => ({type: 'line', field: root, settings}),
  };
  return generateLineChartVegaSpecV2(metadata, plugin).spec;
}

describeChartLabelTests('line_chart', buildLineSpec);
