/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterASTNode} from '../../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeHandler = (node: FilterASTNode, parent?: FilterASTNode) => any;

/**
 * Traverses the tree depth-first inorder (left, root, right) and assigns an id atribute to each node
 */
export const inorderTraversal = (
  root: FilterASTNode,
  nodeHandler: NodeHandler
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inorder = (node: any, parent: any) => {
    if (node) {
      inorder(node.left, node);
      nodeHandler(node, parent);
      inorder(node.right, node);
    }
  };
  inorder(root, null);
};
