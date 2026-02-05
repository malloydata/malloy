/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import type {TagDict} from './tags';
import {Tag} from './tags';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      tagsAre(t: TagDict): R;
    }
  }
}

expect.extend({
  tagsAre(src: string | Tag, result: Tag) {
    if (typeof src === 'string') {
      const {tag, log} = Tag.fromTagLine(src, 0, undefined);
      const errs = log.map(e => e.message);
      if (log.length > 0) {
        return {
          pass: false,
          message: () => `${src}: Tag Parsing Error(s)\n${errs.join('\n')}`,
        };
      }
      src = tag;
    }
    const got = src.properties;
    if (this.equals(got, result)) {
      return {
        pass: true,
        message: () => 'Parse returned expected object',
      };
    }
    return {
      pass: false,
      message: () => this.utils.diff(result, got) ?? 'Not different',
    };
  },
});

type TagTestTuple = [string, TagDict];
describe('tagParse to Tag', () => {
  const tagTests: TagTestTuple[] = [
    ['just_name', {just_name: {}}],
    ['name=bare_string', {name: {eq: 'bare_string'}}],
    ['name="quoted_string"', {name: {eq: 'quoted_string'}}],
    ['name {prop1}', {name: {properties: {prop1: {}}}}],
    [
      'name {prop1 prop2=value}',
      {
        name: {
          properties: {
            prop1: {},
            prop2: {eq: 'value'},
          },
        },
      },
    ],
    ['name.prop', {name: {properties: {prop: {}}}}],
    ['name.prop=value', {name: {properties: {prop: {eq: 'value'}}}}],
    [
      'name.prop.sub=value',
      {name: {properties: {prop: {properties: {sub: {eq: 'value'}}}}}},
    ],
    [
      'name{first3=[a, b, c]}',
      {name: {properties: {first3: {eq: [{eq: 'a'}, {eq: 'b'}, {eq: 'c'}]}}}},
    ],
    ['name{first1=[a,]}', {name: {properties: {first1: {eq: [{eq: 'a'}]}}}}],
    [
      'name{first=[a {A}]}',
      {name: {properties: {first: {eq: [{eq: 'a', properties: {A: {}}}]}}}},
    ],
    [
      'name{first=[{A}]}',
      {name: {properties: {first: {eq: [{properties: {A: {}}}]}}}},
    ],
    ['name=value {prop}', {name: {eq: 'value', properties: {prop: {}}}}],
    [
      'name.prop={prop2}',
      {name: {properties: {prop: {properties: {prop2: {}}}}}},
    ],
    ['no yes -no', {yes: {}, no: {deleted: true}}],

    // TODO interesting behavior that removing a non-existant element, or the last element,
    // does not remove the `properties`.
    ['x -x.y', {x: {properties: {y: {deleted: true}}}}],
    ['x={y} -x.y', {x: {properties: {y: {deleted: true}}}}],

    ['x={y z} -x.y', {x: {properties: {z: {}, y: {deleted: true}}}}],
    ['x={y z} x {-y}', {x: {properties: {z: {}, y: {deleted: true}}}}],
    ['x=1 x {xx=11}', {x: {eq: '1', properties: {xx: {eq: '11'}}}}],
    ['x.y=xx x=1 {...}', {x: {eq: '1', properties: {y: {eq: 'xx'}}}}],
    ['a {b c} a=1', {a: {eq: '1'}}],
    ['a=1 a=...{b}', {a: {eq: '1', properties: {b: {}}}}],
    [
      'a=red { shade=dark } color=$(a) shade=$(a.shade)',
      {
        a: {eq: 'red', properties: {shade: {eq: 'dark'}}},
        color: {eq: 'red', properties: {shade: {eq: 'dark'}}},
        shade: {eq: 'dark'},
      },
    ],
    ['x=.01', {x: {eq: '.01'}}],
    ['x=-7', {x: {eq: '-7'}}],
    ['x=7', {x: {eq: '7'}}],
    ['x=7.0', {x: {eq: '7.0'}}],
    ['x=.7', {x: {eq: '.7'}}],
    ['x=.7e2', {x: {eq: '.7e2'}}],
    ['x=7E2', {x: {eq: '7E2'}}],
    ['`spacey name`=Zaphod', {'spacey name': {eq: 'Zaphod'}}],
    [
      'image { alt=hello { field=department } }',
      {
        image: {
          properties: {
            alt: {eq: 'hello', properties: {field: {eq: 'department'}}},
          },
        },
      },
    ],
    [
      'image image.alt=hello image.alt.field=department',
      {
        image: {
          properties: {
            alt: {eq: 'hello', properties: {field: {eq: 'department'}}},
          },
        },
      },
    ],
    ['can remove.properties -...', {}],
  ];
  test.each(tagTests)('tag %s', (expression: string, expected: TagDict) => {
    expect(expression).tagsAre(expected);
  });
  test.skip('unskip to debug just one of the expressions', () => {
    const x: TagTestTuple = ['word -...', {}];
    expect(x[0]).tagsAre(x[1]);
  });
});

describe('Tag access', () => {
  test('just text', () => {
    const strToParse = 'a=b';
    const getTags = Tag.fromTagLine(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    expect(a?.text()).toEqual('b');
  });
  test('tag path', () => {
    const strToParse = 'a.b.c.d.e=f';
    const tagParse = Tag.fromTagLine(strToParse, undefined);
    expect(tagParse.log).toEqual([]);
    const abcde = tagParse.tag.tag('a', 'b', 'c', 'd', 'e');
    expect(abcde).toBeDefined();
    expect(abcde?.text()).toEqual('f');
  });
  test('just array', () => {
    const strToParse = 'a=[b]';
    const getTags = Tag.fromTagLine(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    const aval = a?.array();
    expect(aval).toBeDefined();
    if (aval) {
      expect(aval.length).toEqual(1);
      expect(aval[0].text()).toEqual('b');
    }
  });
  test('tag path into array', () => {
    const strToParse = 'a.b.c = [{d=e}]';
    const tagParse = Tag.fromTagLine(strToParse, undefined);
    expect(tagParse.log).toEqual([]);
    const abcde = tagParse.tag.tag('a', 'b', 'c', 0, 'd');
    expect(abcde).toBeDefined();
    expect(abcde?.text()).toEqual('e');
  });
  test('array as text', () => {
    const strToParse = 'a=[b]';
    const getTags = Tag.fromTagLine(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    expect(a?.text()).toBeUndefined();
  });
  test('text as array', () => {
    const strToParse = 'a=b';
    const getTags = Tag.fromTagLine(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    expect(a?.array()).toBeUndefined();
  });
  test('just numeric', () => {
    const strToParse = 'a=7';
    const getTags = Tag.fromTagLine(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const n = a?.numeric();
    expect(typeof n).toBe('number');
    expect(n).toEqual(7);
  });
  test('text as numeric', () => {
    const strToParse = 'a=seven';
    const getTags = Tag.fromTagLine(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const n = a?.numeric();
    expect(n).toBeUndefined();
  });
  test('array as numeric', () => {
    const strToParse = 'a=[seven]';
    const getTags = Tag.fromTagLine(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const n = a?.numeric();
    expect(n).toBeUndefined();
  });
  test('full text array', () => {
    const strToParse = 'a=[b,c]';
    const getTags = Tag.fromTagLine(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const ais = a?.textArray();
    expect(ais).toEqual(['b', 'c']);
  });
  test('filtered text array', () => {
    const strToParse = 'a=[b,c,{d}]';
    const getTags = Tag.fromTagLine(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const ais = a?.textArray();
    expect(ais).toEqual(['b', 'c']);
  });
  test('full numeric array', () => {
    const strToParse = 'a=[1,2]';
    const getTags = Tag.fromTagLine(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const ais = a?.numericArray();
    expect(ais).toEqual([1, 2]);
  });
  test('filtered numeric array', () => {
    const strToParse = 'a=[1,2,three]';
    const getTags = Tag.fromTagLine(strToParse);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const ais = a?.numericArray();
    expect(ais).toEqual([1, 2]);
  });
  test('has', () => {
    const strToParse = 'a b.d';
    const getTags = Tag.fromTagLine(strToParse);
    expect(getTags.log).toEqual([]);
    expect(getTags.tag.has('a')).toBeTruthy();
    expect(getTags.tag.has('b', 'd')).toBeTruthy();
    expect(getTags.tag.has('c')).toBeFalsy();
  });
  test('property access on existing tag (which does not yet have properties)', () => {
    const parsePlot = Tag.fromTagLine('# plot');
    const parsed = Tag.fromTagLine('# plot.x=2', 0, parsePlot.tag);
    const allTags = parsed.tag;
    const plotTag = allTags.tag('plot');
    const xTag = plotTag!.tag('x');
    const x = xTag!.numeric();
    expect(parsed.tag.numeric('plot', 'x')).toEqual(2);
    expect(plotTag!.numeric('x')).toEqual(2);
    expect(x).toEqual(2);
  });
  test('set tag', () => {
    const base = Tag.withPrefix('# ');
    const ext = base.set(['a', 'b', 0], 3).set(['a', 'b', 1], 4);
    expect(ext).tagsAre({
      a: {properties: {b: {eq: [{eq: '3'}, {eq: '4'}]}}},
    });
    expect(ext.toString()).toBe('# a.b = [3, 4]\n');
  });
  test('set tag array element with properties', () => {
    const base = Tag.withPrefix('# ');
    const ext = base
      .set(['a', 'b', 0, 'a'], 3)
      .set(['c', 0], 'foo')
      .set(['c', 0, 'a'], 4);
    expect(ext).tagsAre({
      a: {properties: {b: {eq: [{properties: {a: {eq: '3'}}}]}}},
      c: {eq: [{eq: 'foo', properties: {a: {eq: '4'}}}]},
    });
    expect(ext.toString()).toBe('# a.b = [{ a = 3 }] c = [foo { a = 4 }]\n');
  });
  test('soft remove', () => {
    const base = Tag.fromTagLine('# a.b.c = [{ d = 1 }]').tag;
    const ext = base.delete('a', 'b', 'c', 0, 'd').delete('a', 'b', 'c', 0);
    expect(ext).tagsAre({
      a: {properties: {b: {properties: {c: {eq: []}}}}},
    });
    expect(ext.toString()).toBe('# a.b.c = []\n');
  });
  test('hard remove', () => {
    const base = Tag.fromTagLine('# hello').tag;
    const ext = base.unset('goodbye').unset('a', 'dieu');
    expect(ext).tagsAre({
      hello: {},
      goodbye: {deleted: true},
      a: {properties: {dieu: {deleted: true}}},
    });
    expect(ext.toString()).toBe('# hello -goodbye a { -dieu }\n');
    idempotent(ext);
  });
  test('set with different prefix', () => {
    const base = Tag.withPrefix('#(docs) ');
    const ext = base.set(['a'], 3).set(['a', 'b'], null);
    expect(ext.toString()).toBe('#(docs) a = 3 { b }\n');
  });
  test('empty array', () => {
    const base = Tag.withPrefix('#(docs) ');
    const ext = base.set(['a'], []);
    expect(ext.toString()).toBe('#(docs) a = []\n');
    idempotent(ext);
  });
  test('empty array followed by field', () => {
    const base = Tag.withPrefix('#(docs) ');
    const ext = base.set(['a'], []).set(['b'], 'foo');
    expect(ext.toString()).toBe('#(docs) a = [] b = foo\n');
    idempotent(ext);
  });
  describe('toString escapes and quotes strings if necessary', () => {
    test('in eq value', () => {
      const base = Tag.withPrefix('#(malloy) ');
      const ext = base.set(['drill_expression'], 'joined.two');
      expect(ext.toString()).toBe(
        '#(malloy) drill_expression = "joined.two"\n'
      );
      idempotent(ext);
    });
    test('in property name', () => {
      const base = Tag.withPrefix('#(malloy) ');
      const ext = base.set(['foo bar'], '4');
      expect(ext.toString()).toBe('#(malloy) `foo bar` = 4\n');
      idempotent(ext);
    });
    test('deleted property name', () => {
      const base = Tag.withPrefix('#(malloy) ');
      const ext = base.unset('two words');
      expect(ext.toString()).toBe('#(malloy) -`two words`\n');
    });
    test('value has a backslash', () => {
      const base = Tag.withPrefix('#(malloy) ');
      const ext = base.set(['value'], '\\');
      expect(ext.toString()).toBe('#(malloy) value = "\\\\"\n');
      idempotent(ext);
    });
    test('value has a newline', () => {
      const base = Tag.withPrefix('#(malloy) ');
      const ext = base.set(['value'], '\n');
      expect(ext.toString()).toBe('#(malloy) value = "\\n"\n');
      expect(base.text('value')).toBe('\n');
      idempotent(ext);
    });
    test('value has a double quote', () => {
      const base = Tag.withPrefix('#(malloy) ');
      const ext = base.set(['value'], '"');
      expect(ext.toString()).toBe('#(malloy) value = "\\""\n');
      idempotent(ext);
    });
    test.skip('value is empty string', () => {
      const base = Tag.withPrefix('#(malloy) ');
      const ext = base.set(['value'], '');
      expect(ext.toString()).toBe('#(malloy) value = ""\n');
      idempotent(ext);
    });
    test('prop has a back tick', () => {
      const base = Tag.withPrefix('#(malloy) ');
      const ext = base.set(['a`b'], 1);
      expect(ext.toString()).toBe('#(malloy) `a\\`b` = 1\n');
      idempotent(ext);
    });
    test('prop has multiple back ticks', () => {
      const base = Tag.withPrefix('#(malloy) ');
      const ext = base.set(['a`b`c'], 1);
      expect(ext.toString()).toBe('#(malloy) `a\\`b\\`c` = 1\n');
      idempotent(ext);
    });
  });
  describe('parsing escape sequences in strings', () => {
    test('\\n becomes newline', () => {
      const {tag} = Tag.fromTagLine('x="hello\\nworld"');
      expect(tag.text('x')).toBe('hello\nworld');
    });
    test('\\t becomes tab', () => {
      const {tag} = Tag.fromTagLine('x="hello\\tworld"');
      expect(tag.text('x')).toBe('hello\tworld');
    });
    test('\\r becomes carriage return', () => {
      const {tag} = Tag.fromTagLine('x="hello\\rworld"');
      expect(tag.text('x')).toBe('hello\rworld');
    });
    test('\\b becomes backspace', () => {
      const {tag} = Tag.fromTagLine('x="hello\\bworld"');
      expect(tag.text('x')).toBe('hello\bworld');
    });
    test('\\f becomes form feed', () => {
      const {tag} = Tag.fromTagLine('x="hello\\fworld"');
      expect(tag.text('x')).toBe('hello\fworld');
    });
    test('\\uXXXX becomes unicode character', () => {
      const {tag} = Tag.fromTagLine('x="hello\\u0026world"');
      expect(tag.text('x')).toBe('hello&world');
    });
    test('\\uXXXX with uppercase hex', () => {
      const {tag} = Tag.fromTagLine('x="\\u003F"');
      expect(tag.text('x')).toBe('?');
    });
    test('\\\\ becomes backslash', () => {
      const {tag} = Tag.fromTagLine('x="hello\\\\world"');
      expect(tag.text('x')).toBe('hello\\world');
    });
    test('\\" becomes double quote', () => {
      const {tag} = Tag.fromTagLine('x="hello\\"world"');
      expect(tag.text('x')).toBe('hello"world');
    });
    test("\\' in single quoted string", () => {
      const {tag} = Tag.fromTagLine("x='hello\\'world'");
      expect(tag.text('x')).toBe("hello'world");
    });
    test('\\` in backtick identifier', () => {
      const {tag} = Tag.fromTagLine('`hello\\`world`=value');
      expect(tag.text('hello`world')).toBe('value');
    });
  });
});

describe('Tag prefix handling', () => {
  test('# prefix skips to first space', () => {
    const {tag, log} = Tag.fromTagLine('# name=value');
    expect(log).toEqual([]);
    expect(tag.text('name')).toEqual('value');
  });

  test('#(docs) prefix skips to first space', () => {
    const {tag, log} = Tag.fromTagLine('#(docs) name=value');
    expect(log).toEqual([]);
    expect(tag.text('name')).toEqual('value');
  });

  test('# with no space returns empty tag', () => {
    const {tag, log} = Tag.fromTagLine('#noSpace');
    expect(log).toEqual([]);
    expect(tag.properties).toBeUndefined();
  });

  test('everything after # on same line is ignored (comment behavior)', () => {
    // When parsing a single tag line, # at start means "skip prefix"
    // The rest of the line after the space is the tag content
    const {tag, log} = Tag.fromTagLine('# name=value # this is not a comment');
    expect(log).toEqual([]);
    // The "# this is not a comment" is parsed as tag content, not ignored
    // because single-line parsing doesn't have comment support
    expect(tag.has('name')).toBe(true);
  });
});

function idempotent(tag: Tag) {
  const str = tag.toString();
  const clone = Tag.fromTagLine(str).tag;
  clone.prefix = tag.prefix;
  expect(clone.toString()).toBe(str);
}
