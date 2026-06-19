/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Stands in for chart-v2, whose solid-js JSX and `chart.css?raw` import do not
// load under the node test environment; tests never render the component.
export const ChartV2 = () => null;
