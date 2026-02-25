/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {BuildNode} from '@malloydata/malloy';

/**
 * Flatten a BuildNode tree into topological order (dependencies first).
 */
export function flattenBuildNodes(nodes: BuildNode[]): BuildNode[] {
  const result: BuildNode[] = [];
  const seen = new Set<string>();

  function visit(node: BuildNode) {
    if (seen.has(node.sourceID)) return;
    for (const dep of node.dependsOn) {
      visit(dep);
    }
    seen.add(node.sourceID);
    result.push(node);
  }

  for (const node of nodes) {
    visit(node);
  }

  return result;
}
