/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Test stand-in for chart-layout-settings, whose real implementation needs
// vega's scale() and DOM text measurement; fixed dimensions are fine because
// the chart spec tests assert titles, not layout.
export const getChartLayoutSettings = () => ({
  plotWidth: 300,
  plotHeight: 200,
  totalWidth: 400,
  totalHeight: 300,
  isSpark: false,
  padding: {top: 0, left: 0, right: 0, bottom: 0},
  xAxis: {labelAngle: 0, hidden: false},
  yAxis: {hidden: false, tickCount: 5, width: 40, yTitleSize: 12},
  yScale: {domain: [0, 100]},
});

export const getXAxisSettings = () => ({});
