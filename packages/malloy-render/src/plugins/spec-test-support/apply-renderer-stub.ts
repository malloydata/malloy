/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Stands in for apply-renderer, whose solid-js rendering does not load under
// the node test environment; custom-tooltip values are lazy and never rendered
// in these tests.
export const applyRenderer = () => ({renderAs: '', renderValue: null});
