/*

 MIT License

 Copyright (c) 2022 Looker Data Sciences, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

 */
import {removeNode} from './remove_node';
import {treeToList} from './tree_to_list';

describe('Remove node', () => {
  it('One tree node returns undefined', () => {
    const root = {id: 'n1', type: '=', value: 10};
    const ast = removeNode(root, 'n1');
    expect(ast).toBeUndefined();
  });

  it('Three tree node reduces to one when removing left leaf', () => {
    const n0 = {id: 'n0', type: '=', value: 10};
    const n1 = {id: 'n1', type: '=', value: 15};
    const root = {id: 'root', left: n0, right: n1};

    const ast = removeNode(root, 'n0');

    expect(ast?.value).toEqual(15);
    expect(ast && treeToList(ast)).toHaveLength(1);
  });

  it('Three tree node reduces to one when removing right leaf', () => {
    const n0 = {id: 'n0', type: '=', value: 10};
    const n1 = {id: 'n1', type: '=', value: 15};
    const root = {id: 'root', left: n0, right: n1};

    const ast = removeNode(root, 'n1');

    expect(ast?.value).toEqual(10);
    expect(ast && treeToList(ast)).toHaveLength(1);
  });

  it('Five tree node reduces to 3 when removing right leaf', () => {
    const m0 = {id: 'm0', type: '=', value: 10};
    const m1 = {id: 'm1', type: '=', value: 10};
    const n0 = {id: 'n0', type: '=', value: 10};
    const n1 = {id: 'n1', left: m0, right: m1};
    const root = {id: 'root', left: n0, right: n1};

    const ast = removeNode(root, 'm1');

    expect(ast && treeToList(ast)).toHaveLength(3);
  });

  it('Five tree node reduces to 3 when removing left leaf', () => {
    const m0 = {id: 'm0', type: '=', value: 10};
    const m1 = {id: 'm1', type: '=', value: 10};
    const n0 = {id: 'n0', type: '=', value: 10};
    const n1 = {id: 'n1', left: m0, right: m1};
    const root = {id: 'root', left: n0, right: n1};

    const ast = removeNode(root, 'm0');

    expect(ast && treeToList(ast)).toHaveLength(3);
  });

  it('Seven tree node reduces to 5 when removing left leaf', () => {
    const x0 = {id: 'x0', type: '=', value: 10};
    const x1 = {id: 'x1', type: '=', value: 10};
    const m0 = {id: 'm0', type: '=', value: 10};
    const m1 = {id: 'm1', left: x0, right: x1};
    const n0 = {id: 'n0', type: '=', value: 10};
    const n1 = {id: 'n1', left: m0, right: m1};
    const root = {id: 'root', left: n0, right: n1};

    const ast = removeNode(root, 'x0');

    expect(ast && treeToList(ast)).toHaveLength(5);
  });

  it('Tree stays same size if we cant find node', () => {
    const x0 = {id: 'x0', type: '=', value: 10};
    const x1 = {id: 'x1', type: '=', value: 10};
    const m0 = {id: 'm0', type: '=', value: 10};
    const m1 = {id: 'm1', left: x0, right: x1};
    const n0 = {id: 'n0', type: '=', value: 10};
    const n1 = {id: 'n1', left: m0, right: m1};
    const root = {id: 'root', left: n0, right: n1};

    const ast = removeNode(root, 'cantfindme');

    expect(ast && treeToList(ast)).toHaveLength(7);
  });
});
