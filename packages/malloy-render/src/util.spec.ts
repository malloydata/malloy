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
      {value: '#foo baz=42'},
    ];

    const tag = renderTagFromAnnotations(annotations);
    expect(tag.has('bar_chart')).toBe(true);
    expect(tag.text('size')).toBe('md');
    expect(tag.text('baz')).toBeUndefined();
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

describe('formatBigNumber', () => {
  // Import the function
  const {formatBigNumber} = require('./util');

  test('should format thousands with K suffix', () => {
    expect(formatBigNumber(1000)).toBe('1K');
    expect(formatBigNumber(1500)).toBe('1.5K');
    expect(formatBigNumber(9999)).toBe('10K');
    expect(formatBigNumber(1234)).toBe('1.2K');
  });

  test('should format millions with M suffix', () => {
    expect(formatBigNumber(1000000)).toBe('1M');
    expect(formatBigNumber(1500000)).toBe('1.5M');
    expect(formatBigNumber(2300000)).toBe('2.3M');
    expect(formatBigNumber(1234567)).toBe('1.2M');
  });

  test('should format billions with B suffix', () => {
    expect(formatBigNumber(1000000000)).toBe('1B');
    expect(formatBigNumber(1500000000)).toBe('1.5B');
    expect(formatBigNumber(7890000000)).toBe('7.9B');
    expect(formatBigNumber(1234567890)).toBe('1.2B');
  });

  test('should format trillions with T suffix', () => {
    expect(formatBigNumber(1000000000000)).toBe('1T');
    expect(formatBigNumber(1500000000000)).toBe('1.5T');
    expect(formatBigNumber(12340000000000)).toBe('12.3T');
    expect(formatBigNumber(9876543210123)).toBe('9.9T');
  });

  test('should format quadrillions with Q suffix', () => {
    expect(formatBigNumber(1000000000000000)).toBe('1Q');
    expect(formatBigNumber(1500000000000000)).toBe('1.5Q');
    expect(formatBigNumber(2340000000000000)).toBe('2.3Q');
    expect(formatBigNumber(9876543210123456)).toBe('9.9Q');
  });

  test('should not abbreviate numbers less than 1000', () => {
    expect(formatBigNumber(0)).toBe('0');
    expect(formatBigNumber(1)).toBe('1');
    expect(formatBigNumber(999)).toBe('999');
    expect(formatBigNumber(500)).toBe('500');
    expect(formatBigNumber(42)).toBe('42');
  });

  test('should handle negative numbers correctly', () => {
    expect(formatBigNumber(-1000)).toBe('-1K');
    expect(formatBigNumber(-1500)).toBe('-1.5K');
    expect(formatBigNumber(-1500000)).toBe('-1.5M');
    expect(formatBigNumber(-2000000000)).toBe('-2B');
    expect(formatBigNumber(-3500000000000)).toBe('-3.5T');
    expect(formatBigNumber(-999)).toBe('-999');
  });

  test('should strip trailing .0 from formatted numbers', () => {
    expect(formatBigNumber(1000)).toBe('1K'); // Not "1.0K"
    expect(formatBigNumber(2000000)).toBe('2M'); // Not "2.0M"
    expect(formatBigNumber(3000000000)).toBe('3B'); // Not "3.0B"
    expect(formatBigNumber(4000000000000)).toBe('4T'); // Not "4.0T"
  });

  test('should round to 1 decimal place', () => {
    expect(formatBigNumber(1234)).toBe('1.2K');
    expect(formatBigNumber(1256)).toBe('1.3K');
    expect(formatBigNumber(1999)).toBe('2K');
    expect(formatBigNumber(1999999)).toBe('2M');
  });

  test('should handle edge cases', () => {
    expect(formatBigNumber(0.5)).toBe('0.5');
    expect(formatBigNumber(-0.5)).toBe('-0.5');
    expect(formatBigNumber(999.99)).toBe('999.99');
  });

  test('should handle very large numbers', () => {
    expect(formatBigNumber(999999999999999)).toBe('1000T');
    expect(formatBigNumber(1234567890123456789)).toBe('1234.6Q');
  });
});
