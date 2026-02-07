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
import {Tag, RefTag, interfaceFromDict} from './tags';
import {parseTag} from './peggy';

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
      const {tag, log} = parseTag(src);
      const errs = log.map(e => e.message);
      if (log.length > 0) {
        return {
          pass: false,
          message: () => `${src}: Tag Parsing Error(s)\n${errs.join('\n')}`,
        };
      }
      src = tag;
    }
    const got = src.properties ? interfaceFromDict(src.properties) : undefined;
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
    ['x=1 x {xx=11}', {x: {eq: 1, properties: {xx: {eq: 11}}}}],
    ['x.y=xx x=1 {...}', {x: {eq: 1, properties: {y: {eq: 'xx'}}}}],
    ['a {b c} a=1', {a: {eq: 1}}],
    ['a=1 a=...{b}', {a: {eq: 1, properties: {b: {}}}}],
    ['x=.01', {x: {eq: 0.01}}],
    ['x=-7', {x: {eq: -7}}],
    ['x=7', {x: {eq: 7}}],
    ['x=7.0', {x: {eq: 7.0}}],
    ['x=.7', {x: {eq: 0.7}}],
    ['x=.7e2', {x: {eq: 70}}],
    ['x=7E2', {x: {eq: 700}}],
    ['`spacey name`=Zaphod', {'spacey name': {eq: 'Zaphod'}}],
    ["name='single quoted'", {name: {eq: 'single quoted'}}],
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
    // Colon syntax REPLACES properties (deletes old props)
    ['name: { prop }', {name: {properties: {prop: {}}}}],
    ['name: { a=1 b=2 }', {name: {properties: {a: {eq: 1}, b: {eq: 2}}}}],
    ['name { old } name: { new }', {name: {properties: {new: {}}}}],
    // Space syntax MERGES properties (keeps old props)
    ['name { old } name { new }', {name: {properties: {old: {}, new: {}}}}],
    // Colon and space syntax with dotted paths
    ['a.b: { c }', {a: {properties: {b: {properties: {c: {}}}}}}],
    [
      'a.b { c } a.b { d }',
      {a: {properties: {b: {properties: {c: {}, d: {}}}}}},
    ],
    ['a.b { c } a.b: { d }', {a: {properties: {b: {properties: {d: {}}}}}}],
    // Colon syntax deletes existing value
    ['name=val name: { prop }', {name: {properties: {prop: {}}}}],
    // Space syntax preserves existing value
    ['name=val name { prop }', {name: {eq: 'val', properties: {prop: {}}}}],
    // Multi-line input
    [
      'person {\n  name="ted"\n  age=42\n}',
      {person: {properties: {name: {eq: 'ted'}, age: {eq: 42}}}},
    ],
    // Triple-quoted strings (multi-line values)
    ['desc="""hello"""', {desc: {eq: 'hello'}}],
    ['desc="""line one\nline two"""', {desc: {eq: 'line one\nline two'}}],
    ['desc="""has " quote"""', {desc: {eq: 'has " quote'}}],
    ['desc="""has "" two quotes"""', {desc: {eq: 'has "" two quotes'}}],
    // Boolean values
    ['enabled=@true', {enabled: {eq: true}}],
    ['disabled=@false', {disabled: {eq: false}}],
    // Date values
    ['created=@2024-01-15', {created: {eq: new Date('2024-01-15')}}],
    [
      'updated=@2024-01-15T10:30:00Z',
      {updated: {eq: new Date('2024-01-15T10:30:00Z')}},
    ],
    // Mixed types
    [
      'config { enabled=@true count=42 name=test }',
      {
        config: {
          properties: {
            enabled: {eq: true},
            count: {eq: 42},
            name: {eq: 'test'},
          },
        },
      },
    ],
    // Arrays with typed values
    ['flags=[@true, @false]', {flags: {eq: [{eq: true}, {eq: false}]}}],
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
    const getTags = parseTag(strToParse);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    expect(a?.text()).toEqual('b');
  });
  test('tag path', () => {
    const strToParse = 'a.b.c.d.e=f';
    const tagParse = parseTag(strToParse);
    expect(tagParse.log).toEqual([]);
    const abcde = tagParse.tag.tag('a', 'b', 'c', 'd', 'e');
    expect(abcde).toBeDefined();
    expect(abcde?.text()).toEqual('f');
  });
  test('just array', () => {
    const strToParse = 'a=[b]';
    const getTags = parseTag(strToParse);
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
    const tagParse = parseTag(strToParse);
    expect(tagParse.log).toEqual([]);
    const abcde = tagParse.tag.tag('a', 'b', 'c', 0, 'd');
    expect(abcde).toBeDefined();
    expect(abcde?.text()).toEqual('e');
  });
  test('array as text', () => {
    const strToParse = 'a=[b]';
    const getTags = parseTag(strToParse);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    expect(a?.text()).toBeUndefined();
  });
  test('text as array', () => {
    const strToParse = 'a=b';
    const getTags = parseTag(strToParse);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    expect(a?.array()).toBeUndefined();
  });
  test('just numeric', () => {
    const strToParse = 'a=7';
    const getTags = parseTag(strToParse);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const n = a?.numeric();
    expect(typeof n).toBe('number');
    expect(n).toEqual(7);
  });
  test('text as numeric', () => {
    const strToParse = 'a=seven';
    const getTags = parseTag(strToParse);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const n = a?.numeric();
    expect(n).toBeUndefined();
  });
  test('array as numeric', () => {
    const strToParse = 'a=[seven]';
    const getTags = parseTag(strToParse);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const n = a?.numeric();
    expect(n).toBeUndefined();
  });
  test('full text array', () => {
    const strToParse = 'a=[b,c]';
    const getTags = parseTag(strToParse);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const ais = a?.textArray();
    expect(ais).toEqual(['b', 'c']);
  });
  test('filtered text array', () => {
    const strToParse = 'a=[b,c,{d}]';
    const getTags = parseTag(strToParse);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const ais = a?.textArray();
    expect(ais).toEqual(['b', 'c']);
  });
  test('full numeric array', () => {
    const strToParse = 'a=[1,2]';
    const getTags = parseTag(strToParse);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const ais = a?.numericArray();
    expect(ais).toEqual([1, 2]);
  });
  test('filtered numeric array', () => {
    const strToParse = 'a=[1,2,three]';
    const getTags = parseTag(strToParse);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const ais = a?.numericArray();
    expect(ais).toEqual([1, 2]);
  });
  test('has', () => {
    const strToParse = 'a b.d';
    const getTags = parseTag(strToParse);
    expect(getTags.log).toEqual([]);
    expect(getTags.tag.has('a')).toBeTruthy();
    expect(getTags.tag.has('b', 'd')).toBeTruthy();
    expect(getTags.tag.has('c')).toBeFalsy();
  });
  test('boolean accessor', () => {
    const {tag} = parseTag('enabled=@true disabled=@false');
    expect(tag.boolean('enabled')).toBe(true);
    expect(tag.boolean('disabled')).toBe(false);
    expect(tag.boolean('missing')).toBeUndefined();
  });
  test('isTrue and isFalse', () => {
    const {tag} = parseTag('enabled=@true disabled=@false name=test');
    expect(tag.isTrue('enabled')).toBe(true);
    expect(tag.isFalse('enabled')).toBe(false);
    expect(tag.isTrue('disabled')).toBe(false);
    expect(tag.isFalse('disabled')).toBe(true);
    // Non-boolean values
    expect(tag.isTrue('name')).toBe(false);
    expect(tag.isFalse('name')).toBe(false);
    // Missing values
    expect(tag.isTrue('missing')).toBe(false);
    expect(tag.isFalse('missing')).toBe(false);
  });
  test('date accessor', () => {
    const {tag} = parseTag('created=@2024-01-15 updated=@2024-01-15T10:30:00Z');
    const created = tag.date('created');
    expect(created).toBeInstanceOf(Date);
    expect(created?.toISOString()).toBe('2024-01-15T00:00:00.000Z');
    const updated = tag.date('updated');
    expect(updated).toBeInstanceOf(Date);
    expect(updated?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    expect(tag.date('missing')).toBeUndefined();
  });
  test('text returns string for all scalar types', () => {
    const {tag} = parseTag('n=42 b=@true d=@2024-01-15 s=hello');
    expect(tag.text('n')).toBe('42');
    expect(tag.text('b')).toBe('true');
    expect(tag.text('d')).toBe('2024-01-15T00:00:00.000Z');
    expect(tag.text('s')).toBe('hello');
  });
  test('property access on existing tag (which does not yet have properties)', () => {
    const parsePlot = parseTag('# plot');
    const parsed = parseTag('# plot.x=2', parsePlot.tag);
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
      a: {properties: {b: {eq: [{eq: 3}, {eq: 4}]}}},
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
      a: {properties: {b: {eq: [{properties: {a: {eq: 3}}}]}}},
      c: {eq: [{eq: 'foo', properties: {a: {eq: 4}}}]},
    });
    expect(ext.toString()).toBe('# a.b = [{ a = 3 }] c = [foo { a = 4 }]\n');
  });
  test('soft remove', () => {
    const base = parseTag('# a.b.c = [{ d = 1 }]').tag;
    const ext = base.delete('a', 'b', 'c', 0, 'd').delete('a', 'b', 'c', 0);
    expect(ext).tagsAre({
      a: {properties: {b: {properties: {c: {eq: []}}}}},
    });
    expect(ext.toString()).toBe('# a.b.c = []\n');
  });
  test('hard remove', () => {
    const base = parseTag('# hello').tag;
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
      expect(ext.text('value')).toBe('\n');
      idempotent(ext);
    });
    test('value has a double quote', () => {
      const base = Tag.withPrefix('#(malloy) ');
      const ext = base.set(['value'], '"');
      expect(ext.toString()).toBe('#(malloy) value = "\\""\n');
      idempotent(ext);
    });
    test('value is empty string', () => {
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
      const {tag} = parseTag('x="hello\\nworld"');
      expect(tag.text('x')).toBe('hello\nworld');
    });
    test('\\t becomes tab', () => {
      const {tag} = parseTag('x="hello\\tworld"');
      expect(tag.text('x')).toBe('hello\tworld');
    });
    test('\\r becomes carriage return', () => {
      const {tag} = parseTag('x="hello\\rworld"');
      expect(tag.text('x')).toBe('hello\rworld');
    });
    test('\\b becomes backspace', () => {
      const {tag} = parseTag('x="hello\\bworld"');
      expect(tag.text('x')).toBe('hello\bworld');
    });
    test('\\f becomes form feed', () => {
      const {tag} = parseTag('x="hello\\fworld"');
      expect(tag.text('x')).toBe('hello\fworld');
    });
    test('\\uXXXX becomes unicode character', () => {
      const {tag} = parseTag('x="hello\\u0026world"');
      expect(tag.text('x')).toBe('hello&world');
    });
    test('\\uXXXX with uppercase hex', () => {
      const {tag} = parseTag('x="\\u003F"');
      expect(tag.text('x')).toBe('?');
    });
    test('\\\\ becomes backslash', () => {
      const {tag} = parseTag('x="hello\\\\world"');
      expect(tag.text('x')).toBe('hello\\world');
    });
    test('\\" becomes double quote', () => {
      const {tag} = parseTag('x="hello\\"world"');
      expect(tag.text('x')).toBe('hello"world');
    });
    test("\\' in single quoted string", () => {
      const {tag} = parseTag("x='hello\\'world'");
      expect(tag.text('x')).toBe("hello'world");
    });
    test('\\` in backtick identifier', () => {
      const {tag} = parseTag('`hello\\`world`=value');
      expect(tag.text('hello`world')).toBe('value');
    });
  });
});

describe('Tag prefix handling', () => {
  test('# prefix skips to first space', () => {
    const {tag, log} = parseTag('# name=value');
    expect(log).toEqual([]);
    expect(tag.text('name')).toEqual('value');
  });

  test('#(docs) prefix skips to first space', () => {
    const {tag, log} = parseTag('#(docs) name=value');
    expect(log).toEqual([]);
    expect(tag.text('name')).toEqual('value');
  });

  test('# with no space returns empty tag', () => {
    const {tag, log} = parseTag('#noSpace');
    expect(log).toEqual([]);
    expect(tag.properties).toBeUndefined();
  });

  test('everything after # on same line is ignored (comment behavior)', () => {
    // When parsing a single tag line, # at start means "skip prefix"
    // The rest of the line after the space is the tag content
    const {tag, log} = parseTag('# name=value # this is not a comment');
    expect(log).toEqual([]);
    // The "# this is not a comment" is parsed as tag content, not ignored
    // because single-line parsing doesn't have comment support
    expect(tag.has('name')).toBe(true);
  });
});

describe('Empty and whitespace input', () => {
  test('empty string produces empty tag', () => {
    const {tag, log} = parseTag('');
    expect(log).toEqual([]);
    expect(tag.properties).toBeUndefined();
  });

  test('whitespace only produces empty tag', () => {
    const {tag, log} = parseTag('   ');
    expect(log).toEqual([]);
    expect(tag.properties).toBeUndefined();
  });

  test('whitespace with comment produces empty tag', () => {
    const {tag, log} = parseTag('   # this is a comment');
    expect(log).toEqual([]);
    expect(tag.properties).toBeUndefined();
  });
});

describe('Error handling', () => {
  test('syntax error has 0-based line and offset', () => {
    const {log} = parseTag('a = [');
    expect(log.length).toBe(1);
    expect(log[0].code).toBe('tag-parse-syntax-error');
    expect(log[0].line).toBe(0);
    // Error at position 5 (after "a = [")
    expect(log[0].offset).toBeGreaterThan(0);
  });

  test('error offset accounts for input position', () => {
    const {log} = parseTag('valid another_valid oops=');
    expect(log.length).toBe(1);
    expect(log[0].line).toBe(0);
    // Error should be near end of line
    expect(log[0].offset).toBeGreaterThan(20);
  });

  test('error offset after prefix stripping', () => {
    // "# " is stripped, so input becomes " a = ["
    const {log} = parseTag('# a = [');
    expect(log.length).toBe(1);
    expect(log[0].line).toBe(0);
    // Offset is relative to stripped input (after "#")
    expect(log[0].offset).toBeGreaterThan(0);
  });

  test('longer prefix is stripped correctly', () => {
    // "#(docs) " is stripped
    const {log} = parseTag('#(docs) a = [');
    expect(log.length).toBe(1);
    expect(log[0].line).toBe(0);
    // Offset is relative to stripped input (after "#(docs)")
    expect(log[0].offset).toBeGreaterThan(0);
  });

  test('error on second line reports correct line number', () => {
    // Error is on line 1 (0-based), the unclosed bracket
    const {log} = parseTag('valid=1\ninvalid=[');
    expect(log.length).toBe(1);
    expect(log[0].line).toBe(1);
    expect(log[0].offset).toBeGreaterThan(0);
  });

  test('unclosed string with newline produces error', () => {
    // Regular strings cannot contain raw newlines - must close on same line
    const {log} = parseTag('desc="forgot to close\n');
    expect(log.length).toBe(1);
    expect(log[0].line).toBe(0);
  });
});

function idempotent(tag: Tag) {
  const str = tag.toString();
  const clone = parseTag(str).tag;
  clone.prefix = tag.prefix;
  expect(clone.toString()).toBe(str);
}

describe('toObject', () => {
  test('bare tag becomes true', () => {
    const {tag} = parseTag('hidden');
    expect(tag.toObject()).toEqual({hidden: true});
  });

  test('string value becomes string', () => {
    const {tag} = parseTag('color=blue');
    expect(tag.toObject()).toEqual({color: 'blue'});
  });

  test('numeric value becomes number', () => {
    const {tag} = parseTag('size=10');
    expect(tag.toObject()).toEqual({size: 10});
  });

  test('float value becomes number', () => {
    const {tag} = parseTag('ratio=3.14');
    expect(tag.toObject()).toEqual({ratio: 3.14});
  });

  test('properties only becomes nested object', () => {
    const {tag} = parseTag('box { width=100 height=200 }');
    expect(tag.toObject()).toEqual({box: {width: 100, height: 200}});
  });

  test('value and properties uses = key', () => {
    const {tag} = parseTag('link="http://example.com" { target=_blank }');
    expect(tag.toObject()).toEqual({
      link: {'=': 'http://example.com', 'target': '_blank'},
    });
  });

  test('array of simple values', () => {
    const {tag} = parseTag('items=[a, b, c]');
    expect(tag.toObject()).toEqual({items: ['a', 'b', 'c']});
  });

  test('array of numeric values', () => {
    const {tag} = parseTag('nums=[1, 2, 3]');
    expect(tag.toObject()).toEqual({nums: [1, 2, 3]});
  });

  test('array with properties on elements', () => {
    const {tag} = parseTag('items=[a { x=1 }, b { y=2 }]');
    expect(tag.toObject()).toEqual({
      items: [
        {'=': 'a', 'x': 1},
        {'=': 'b', 'y': 2},
      ],
    });
  });

  test('complex nested structure', () => {
    const {tag} = parseTag('# hidden color=blue size=10 box { width=100 }');
    expect(tag.toObject()).toEqual({
      hidden: true,
      color: 'blue',
      size: 10,
      box: {width: 100},
    });
  });

  test('deleted properties are excluded', () => {
    const {tag} = parseTag('a b -a');
    expect(tag.toObject()).toEqual({b: true});
  });

  test('empty tag returns empty object', () => {
    const {tag} = parseTag('');
    expect(tag.toObject()).toEqual({});
  });

  test('deeply nested properties', () => {
    const {tag} = parseTag('a.b.c=1');
    expect(tag.toObject()).toEqual({a: {b: {c: 1}}});
  });

  test('array of objects (dictionaries)', () => {
    const {tag} = parseTag('items=[{name=alice age=30}, {name=bob age=25}]');
    expect(tag.toObject()).toEqual({
      items: [
        {name: 'alice', age: 30},
        {name: 'bob', age: 25},
      ],
    });
  });
});

describe('Tag parent tracking', () => {
  test('root tag has no parent', () => {
    const {tag} = parseTag('a=1');
    expect(tag.parent).toBeUndefined();
    expect(tag.root).toBe(tag);
  });

  test('child tag has parent set', () => {
    const {tag} = parseTag('a { b=1 }');
    const a = tag.tag('a');
    expect(a?.parent).toBe(tag);
  });

  test('nested child has correct parent chain', () => {
    const {tag} = parseTag('a { b { c=1 } }');
    const a = tag.tag('a');
    const b = a?.tag('b');
    const c = b?.tag('c');

    expect(a?.parent).toBe(tag);
    expect(b?.parent).toBe(a);
    expect(c?.parent).toBe(b);
  });

  test('root traverses to top of tree', () => {
    const {tag} = parseTag('a { b { c=1 } }');
    const c = tag.tag('a', 'b', 'c');

    expect(c?.root).toBe(tag);
  });

  test('array elements have parent set to containing tag', () => {
    const {tag} = parseTag('items=[a, b, c]');
    const items = tag.tag('items');
    const arr = items?.array();

    expect(arr?.[0].parent).toBe(items);
    expect(arr?.[1].parent).toBe(items);
    expect(arr?.[2].parent).toBe(items);
  });

  test('nested array elements have correct parents', () => {
    const {tag} = parseTag('items=[{name=alice}, {name=bob}]');
    const items = tag.tag('items');
    const arr = items?.array();
    const alice = arr?.[0];
    const name = alice?.tag('name');

    expect(alice?.parent).toBe(items);
    expect(name?.parent).toBe(alice);
  });

  test('dict accessor returns tags with correct parent', () => {
    const {tag} = parseTag('a=1 b=2 c=3');
    const dict = tag.dict;

    expect(dict['a'].parent).toBe(tag);
    expect(dict['b'].parent).toBe(tag);
    expect(dict['c'].parent).toBe(tag);
  });

  test('entries iterator returns tags with correct parent', () => {
    const {tag} = parseTag('a=1 b=2');
    for (const [, child] of tag.entries()) {
      expect(child.parent).toBe(tag);
    }
  });
});

describe('References (RefTag)', () => {
  test('absolute reference resolves to root property', () => {
    const {tag} = parseTag('source=hello target=$source');
    expect(tag.text('target')).toBe('hello');
  });

  test('absolute reference with path resolves correctly', () => {
    const {tag} = parseTag(
      'config { db { host=localhost } } target=$config.db.host'
    );
    expect(tag.text('target')).toBe('localhost');
  });

  test('relative reference up one level', () => {
    const {tag} = parseTag('outer { value=42 inner { ref=$^value } }');
    expect(tag.numeric('outer', 'inner', 'ref')).toBe(42);
  });

  test('relative reference up two levels', () => {
    const {tag} = parseTag('root=hello outer { inner { ref=$^^root } }');
    expect(tag.text('outer', 'inner', 'ref')).toBe('hello');
  });

  test('reference with array index', () => {
    const {tag} = parseTag('items=[first, second, third] target=$items[1]');
    expect(tag.text('target')).toBe('second');
  });

  test('reference in array', () => {
    const {tag} = parseTag('source=value refs=[$source, $source]');
    const arr = tag.textArray('refs');
    expect(arr).toEqual(['value', 'value']);
  });

  test('unresolved reference returns undefined', () => {
    const {tag} = parseTag('ref=$nonexistent');
    expect(tag.text('ref')).toBeUndefined();
  });

  test('RefTag.toRefString() returns source representation', () => {
    const {tag} = parseTag('ref=$path.to.thing');
    const ref = tag.tag('ref');
    expect(ref).toBeInstanceOf(RefTag);
    expect((ref as RefTag).toRefString()).toBe('$path.to.thing');
  });

  test('RefTag.toRefString() with ups', () => {
    const {tag} = parseTag('a { ref=$^^root.path }');
    const ref = tag.tag('a', 'ref');
    expect(ref).toBeInstanceOf(RefTag);
    expect((ref as RefTag).toRefString()).toBe('$^^root.path');
  });

  test('RefTag.toRefString() with array index', () => {
    const {tag} = parseTag('ref=$items[0].name');
    const ref = tag.tag('ref');
    expect(ref).toBeInstanceOf(RefTag);
    expect((ref as RefTag).toRefString()).toBe('$items[0].name');
  });

  test('chained reference access', () => {
    const {tag} = parseTag('data { name=alice age=30 } ref=$data');
    expect(tag.text('ref', 'name')).toBe('alice');
    expect(tag.numeric('ref', 'age')).toBe(30);
  });

  test('reference has correct parent', () => {
    const {tag} = parseTag('outer { ref=$something }');
    const outer = tag.tag('outer');
    const ref = outer?.tag('ref');
    expect(ref?.parent).toBe(outer);
  });

  describe('validateReferences', () => {
    test('no errors for valid references', () => {
      const {tag} = parseTag('source=hello target=$source');
      expect(tag.validateReferences()).toEqual([]);
    });

    test('error for unresolved reference', () => {
      const {tag} = parseTag('ref=$nonexistent');
      const errors = tag.validateReferences();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Unresolved reference');
      expect(errors[0]).toContain('$nonexistent');
    });

    test('error for unresolved nested reference', () => {
      const {tag} = parseTag('outer { inner { ref=$missing } }');
      const errors = tag.validateReferences();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('outer.inner.ref');
    });

    test('error for reference that goes up too far', () => {
      const {tag} = parseTag('ref=$^^^^^way.too.far');
      const errors = tag.validateReferences();
      expect(errors).toHaveLength(1);
    });

    test('multiple unresolved references', () => {
      const {tag} = parseTag('a=$missing1 b=$missing2');
      const errors = tag.validateReferences();
      expect(errors).toHaveLength(2);
    });
  });

  describe('toJSON for references', () => {
    test('RefTag serializes to linkTo marker', () => {
      const {tag} = parseTag('ref=$path.to.thing');
      const ref = tag.tag('ref');
      expect(ref?.toJSON()).toEqual({linkTo: '$path.to.thing'});
    });

    test('RefTag with ups serializes correctly', () => {
      const {tag} = parseTag('a { ref=$^^root }');
      const ref = tag.tag('a', 'ref');
      expect(ref?.toJSON()).toEqual({linkTo: '$^^root'});
    });
  });

  describe('toObject with references', () => {
    test('reference resolves to actual value', () => {
      const {tag} = parseTag('source=hello target=$source');
      const obj = tag.toObject();
      expect(obj['target']).toBe('hello');
    });

    test('reference to object resolves correctly', () => {
      const {tag} = parseTag('data { name=alice } ref=$data');
      const obj = tag.toObject();
      expect(obj['ref']).toEqual({name: 'alice'});
    });

    test('unresolved reference becomes undefined', () => {
      const {tag} = parseTag('ref=$nonexistent');
      const obj = tag.toObject();
      expect(obj['ref']).toBeUndefined();
    });
  });

  describe('cloning with references', () => {
    test('reference survives when extending tag is cloned', () => {
      // Parse two lines - first creates reference, second extends it
      const {tag} = parseTag(['source=hello target=$source', 'extra=data']);
      // The reference should still work after the second parse cloned the first result
      expect(tag.text('target')).toBe('hello');
    });

    test('clone preserves RefTag', () => {
      const {tag} = parseTag('source=hello target=$source');
      const cloned = tag.clone();
      // After cloning, the reference should still resolve
      expect(cloned.text('target')).toBe('hello');
    });
  });
});
