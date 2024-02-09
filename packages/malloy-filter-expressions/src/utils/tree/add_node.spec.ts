/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {addNode} from './add_node';
import {treeToList} from './tree_to_list';

describe('Add Node function', () => {
  it('Ensure when root is singular node gets broken into a balanced tree, comma separated', () => {
    const rootValue = 1;
    const newNodeValue = 2;

    const root = {id: 1, type: '=', value: rootValue};
    const newNode = {id: 2, type: '=', value: newNodeValue};
    const ast = addNode(root, newNode);
    expect(ast.type).toEqual(',');
    expect(ast.left).toBeDefined();
    expect(ast.right).toBeDefined();
    expect(ast.left?.value).toEqual(rootValue);
    expect(ast.right?.value).toEqual(newNodeValue);
  });

  it('Tree node count increases by one', () => {
    const node = {id: 2, type: '=', value: 1};
    const root = {id: 1, right: node};
    const newNode = {id: 3, type: '=', value: 10};

    const nodeListCount = treeToList(root).length;

    const ast = addNode(root, newNode);

    expect(treeToList(ast)).toHaveLength(nodeListCount + 1);
  });
});
