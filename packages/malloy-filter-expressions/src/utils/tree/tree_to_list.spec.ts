/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {treeToList} from './tree_to_list';

describe('filter ast to list', () => {
  it('can convert an ast to array', () => {
    const root = {id: 1, type: '=', value: [1]};
    const list = treeToList(root);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(root);
  });

  it('tree list only holds value nodes', () => {
    const root = {
      id: 1,
      type: ',',
      left: {id: 2, type: '=', vaue: [1]},
      right: {id: 3, type: '>', value: [5]},
    };
    const list = treeToList(root);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual(root.left);
    expect(list[1]).toEqual(root.right);
  });

  it('tree list is sorted by is value of nodes', () => {
    const root = {
      id: 1,
      type: ',',
      left: {id: 2, type: '=', vaue: [1], is: false},
      right: {id: 3, type: '>', value: [5], is: true},
    };
    const list = treeToList(root);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual(root.right);
    expect(list[1]).toEqual(root.left);
  });
});
