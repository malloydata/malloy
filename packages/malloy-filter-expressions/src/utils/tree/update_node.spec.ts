/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {updateNode} from './update_node';

describe('update root', () => {
  it('updates root nodes properties', () => {
    const root = {id: 1, type: '=', value: [1]};
    const updateProps = {value: [2]};
    const ast = updateNode(root, 1, updateProps);
    expect(ast.value).toEqual(updateProps.value);
  });
});

describe('update root.left', () => {
  it('updates root.left properties', () => {
    const root = {
      id: 1,
      type: ',',
      left: {id: 2, type: '=', value: [1]},
      right: {id: 3, type: '>', value: [5]},
    };
    const updateProps = {type: '<'};
    const ast = updateNode(root, 2, updateProps);
    expect(ast.left?.type).toEqual(updateProps.type);
    expect(ast.right).toEqual(root.right);
  });
});

describe('update root.right', () => {
  it('updates root.right properties with a type', () => {
    const root = {
      id: 1,
      type: ',',
      left: {id: 2, type: '=', value: [1]},
      right: {id: 3, type: '>', value: [5]},
    };
    const updateProps = {type: '<'};
    const ast = updateNode(root, 3, updateProps);
    expect(ast.right?.type).toEqual(updateProps.type);
    expect(ast.left).toEqual(root.left);
  });

  it('updates root.right properties with a value', () => {
    const root = {
      id: 1,
      type: ',',
      left: {id: 2, type: '=', value: [1]},
      right: {
        id: 3,
        type: ',',
        left: {id: 4, type: '<', value: [5]},
        right: {id: 5, type: '>', value: [10]},
      },
    };
    const updateProps = {value: [10]};
    const ast = updateNode(root, 3, updateProps);
    expect(ast.right?.right?.value).toEqual(updateProps.value);
    expect(ast.left).toEqual(root.left);
    expect(ast.right?.left).toEqual(root.right.left);
  });
});

describe('updating invalid node id', () => {
  it('has no effect on root ast', () => {
    const root = {
      id: 1,
      type: ',',
      left: {id: 2, type: '=', value: [1]},
      right: {id: 3, type: '>', value: [5]},
    };
    const updateProps = {value: [10]};
    const ast = updateNode(root, 9, updateProps);
    expect(ast).toEqual(root);
  });
});
