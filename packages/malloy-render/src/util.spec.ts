/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import {tagFromAnnotations, renderTagFromAnnotations} from './util';

describe('renderTagFromAnnotations namespace support', () => {
  test('should parse default namespace only', () => {
    const annotations: Malloy.Annotation[] = [
      {value: '# bar_chart'},
      {value: '# size=lg'},
    ];

    const tag = renderTagFromAnnotations(annotations);
    expect(tag.has('bar_chart')).toBe(true);
    expect(tag.text('size')).toBe('lg');
  });

  test('should parse render namespace only', () => {
    const annotations: Malloy.Annotation[] = [
      {value: '#r bar_chart'},
      {value: '#r size=md'},
    ];

    const tag = renderTagFromAnnotations(annotations);
    expect(tag.has('bar_chart')).toBe(true);
    expect(tag.text('size')).toBe('md');
  });

  test('should prefer render namespace over default when both exist', () => {
    const annotations: Malloy.Annotation[] = [
      {value: '# bar_chart'},
      {value: '# size=lg'},
      {value: '#r size=sm'},
      {value: '#r color=blue'},
    ];

    const tag = renderTagFromAnnotations(annotations);
    expect(tag.has('bar_chart')).toBe(true);
    expect(tag.text('size')).toBe('sm'); // render namespace wins
    expect(tag.text('color')).toBe('blue'); // only in render namespace
  });

  test('should merge properties from both namespaces with render taking precedence', () => {
    const annotations: Malloy.Annotation[] = [
      {value: '# bar_chart'},
      {value: '# title="Default Title"'},
      {value: '# height=100'},
      {value: '#r title="Render Title"'},
      {value: '#r width=200'},
    ];

    const tag = renderTagFromAnnotations(annotations);
    expect(tag.has('bar_chart')).toBe(true);
    expect(tag.text('title')).toBe('Render Title'); // render wins
    expect(tag.text('height')).toBe('100'); // from default namespace
    expect(tag.text('width')).toBe('200'); // from render namespace
  });

  test('should handle empty annotations', () => {
    const tag = renderTagFromAnnotations(undefined);
    expect(tag).toBeDefined();
    expect(Object.keys(tag.dict)).toHaveLength(0);
  });

  test('should handle annotations without matching prefixes', () => {
    const annotations: Malloy.Annotation[] = [
      {value: 'no prefix'},
      {value: '#x wrong prefix'},
    ];

    const tag = renderTagFromAnnotations(annotations);
    expect(Object.keys(tag.dict)).toHaveLength(0);
  });

  test('should handle complex tag structures in both namespaces', () => {
    const annotations: Malloy.Annotation[] = [
      {value: '# chart { type=bar x=sales }'},
      {value: '#r chart { type=line color=red }'},
    ];

    const tag = renderTagFromAnnotations(annotations);
    const chartTag = tag.tag('chart');
    expect(chartTag).toBeDefined();
    expect(chartTag?.text('type')).toBe('line'); // render wins
    expect(chartTag?.text('x')).toBe('sales'); // from default
    expect(chartTag?.text('color')).toBe('red'); // from render
  });
});

describe('tagFromAnnotations original behavior', () => {
  test('should preserve original behavior for non-default prefixes', () => {
    const annotations: Malloy.Annotation[] = [
      {value: '#(malloy) query_name=test'},
      {value: '## model_tag=value'},
      {value: '# regular_tag'},
      {value: '#r render_tag'},
    ];

    // Test malloy prefix
    const malloyTag = tagFromAnnotations(annotations, '#(malloy) ');
    expect(malloyTag.text('query_name')).toBe('test');
    expect(malloyTag.has('regular_tag')).toBe(false);
    expect(malloyTag.has('render_tag')).toBe(false);

    // Test model prefix
    const modelTag = tagFromAnnotations(annotations, '## ');
    expect(modelTag.text('model_tag')).toBe('value');
    expect(modelTag.has('regular_tag')).toBe(false);
    expect(modelTag.has('render_tag')).toBe(false);
  });

  test('should use default # prefix when no prefix specified', () => {
    const annotations: Malloy.Annotation[] = [
      {value: '# bar_chart'},
      {value: '#r line_chart'}, // should be ignored
      {value: '# size=lg'},
    ];

    const tag = tagFromAnnotations(annotations);
    expect(tag.has('bar_chart')).toBe(true);
    expect(tag.has('line_chart')).toBe(false); // #r ignored
    expect(tag.text('size')).toBe('lg');
  });
});
