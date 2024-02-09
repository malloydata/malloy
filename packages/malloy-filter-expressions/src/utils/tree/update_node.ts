/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterASTNode} from '../../types';

/**
 * Traverses the Filter AST looking for a node with id = nodeId and applies updateProps to it
 */
export const updateNode = (
  root: FilterASTNode,
  nodeId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateProps: any
): FilterASTNode => {
  if (root['id'] === nodeId) {
    return {...root, ...updateProps};
  }

  let node: FilterASTNode | undefined = root;
  while (node) {
    const {left, right} = node;
    if (left && left['id'] === nodeId) {
      node.left = {...left, ...updateProps};
      return root;
    }

    if (right && right['id'] === nodeId) {
      node.right = {...right, ...updateProps};
      return root;
    }

    node = node.right;
  }
  return root;
};
