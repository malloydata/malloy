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
import {Tag, interfaceFromDict} from './tags';
import {parseTag, parseAnnotation, TagParser} from './parser';
import type {SourceOrigin} from './parser';

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
    const parsed = parseAnnotation(['# plot', '# plot.x=2']);
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
    const base = parseAnnotation('# a.b.c = [{ d = 1 }]').tag;
    const ext = base.delete('a', 'b', 'c', 0, 'd').delete('a', 'b', 'c', 0);
    expect(ext).tagsAre({
      a: {properties: {b: {properties: {c: {eq: []}}}}},
    });
    expect(ext.toString()).toBe('# a.b.c = []\n');
  });
  test('hard remove', () => {
    const base = parseAnnotation('# hello').tag;
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
  describe('scalarType', () => {
    test('returns string for quoted value', () => {
      const {tag} = parseTag('x="hello"');
      expect(tag.scalarType('x')).toBe('string');
    });
    test('returns number for numeric value', () => {
      const {tag} = parseTag('x=42');
      expect(tag.scalarType('x')).toBe('number');
    });
    test('returns boolean for boolean value', () => {
      const {tag} = parseTag('x=@true');
      expect(tag.scalarType('x')).toBe('boolean');
    });
    test('returns undefined for tag without value', () => {
      const {tag} = parseTag('x');
      expect(tag.scalarType('x')).toBeUndefined();
    });
    test('returns undefined for missing tag', () => {
      const {tag} = parseTag('x=1');
      expect(tag.scalarType('y')).toBeUndefined();
    });
    test('works with path', () => {
      const {tag} = parseTag('x { y="hello" }');
      expect(tag.scalarType('x', 'y')).toBe('string');
    });
    test('distinguishes number=0 from number="0"', () => {
      const {tag: bare} = parseTag('number=0');
      expect(bare.scalarType('number')).toBe('number');
      const {tag: quoted} = parseTag('number="0"');
      expect(quoted.scalarType('number')).toBe('string');
    });
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
    test("\\' in single quoted string is raw (backslash preserved)", () => {
      const {tag} = parseTag("x='hello\\'world'");
      expect(tag.text('x')).toBe("hello\\'world");
    });
    test('\\` in backtick identifier', () => {
      const {tag} = parseTag('`hello\\`world`=value');
      expect(tag.text('hello`world')).toBe('value');
    });
  });
});

describe('Annotation prefix handling', () => {
  test('# prefix skips to first space', () => {
    const {tag, log} = parseAnnotation('# name=value');
    expect(log).toEqual([]);
    expect(tag.text('name')).toEqual('value');
  });

  test('#(docs) prefix skips to first space', () => {
    const {tag, log} = parseAnnotation('#(docs) name=value');
    expect(log).toEqual([]);
    expect(tag.text('name')).toEqual('value');
  });

  test('# with no space returns empty tag', () => {
    const {tag, log} = parseAnnotation('#noSpace');
    expect(log).toEqual([]);
    expect(tag.properties).toBeUndefined();
  });

  test('parseTag does not strip # prefix', () => {
    // # starts a MOTLY comment, so parseTag should treat it as a comment
    const {tag, log} = parseTag('# name=value');
    expect(log).toEqual([]);
    expect(tag.has('name')).toBe(false);
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
    const {log} = parseAnnotation('# a = [');
    expect(log.length).toBe(1);
    expect(log[0].line).toBe(0);
    // Offset is relative to stripped input (after "#")
    expect(log[0].offset).toBeGreaterThan(0);
  });

  test('longer prefix is stripped correctly', () => {
    // "#(docs) " is stripped
    const {log} = parseAnnotation('#(docs) a = [');
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

describe('References are dropped', () => {
  test('reference property is treated as deleted', () => {
    const {tag} = parseTag('x=$y');
    expect(tag.has('x')).toBe(false);
  });

  test('non-reference siblings are preserved', () => {
    const {tag} = parseTag('a=1 b=$c d=2');
    expect(tag.numeric('a')).toBe(1);
    expect(tag.has('b')).toBe(false);
    expect(tag.numeric('d')).toBe(2);
  });

  test('reference in array is treated as deleted', () => {
    const {tag} = parseTag('items=[hello, $ref, world]');
    const arr = tag.array('items');
    expect(arr).toBeDefined();
    expect(arr!.length).toBe(3);
    expect(arr![0].text()).toBe('hello');
    expect(arr![1].deleted).toBe(true);
    expect(arr![2].text()).toBe('world');
  });
});

function idempotent(tag: Tag) {
  const str = tag.toString();
  const clone = parseAnnotation(str).tag;
  clone.prefix = tag.prefix;
  // Check that round-trip is stable (second parse matches first),
  // property ordering may differ from the original Tag API order.
  const str2 = clone.toString();
  const clone2 = parseAnnotation(str2).tag;
  clone2.prefix = tag.prefix;
  expect(clone2.toString()).toBe(str2);
}

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

describe('Read tracking', () => {
  test('newly created tags are unread', () => {
    const tag = new Tag({
      properties: {
        hidden: {},
        label: {eq: 'Name'},
      },
    });
    expect(tag.getUnreadProperties()).toEqual([['hidden'], ['label']]);
  });

  test('has() marks a tag as read', () => {
    const tag = new Tag({
      properties: {
        hidden: {},
        label: {eq: 'Name'},
      },
    });
    tag.has('hidden');
    expect(tag.getUnreadProperties()).toEqual([['label']]);
  });

  test('text() marks a tag as read', () => {
    const tag = new Tag({
      properties: {
        label: {eq: 'Name'},
        color: {eq: 'blue'},
      },
    });
    tag.text('label');
    expect(tag.getUnreadProperties()).toEqual([['color']]);
  });

  test('nested property tracking', () => {
    const tag = new Tag({
      properties: {
        viz: {
          eq: 'bar',
          properties: {
            x: {eq: 'category'},
            yy: {eq: 'total'},
          },
        },
      },
    });
    // Read viz and x, but not yy
    tag.text('viz');
    tag.text('viz', 'x');
    expect(tag.getUnreadProperties()).toEqual([['viz', 'yy']]);
  });

  test('unread nested tags under unread parent are reported as parent only', () => {
    const tag = new Tag({
      properties: {
        viz: {
          properties: {
            x: {eq: 'category'},
          },
        },
      },
    });
    // Don't read anything
    expect(tag.getUnreadProperties()).toEqual([['viz']]);
  });

  test('resetReadTracking clears all reads', () => {
    const tag = new Tag({
      properties: {
        hidden: {},
        label: {eq: 'Name'},
      },
    });
    tag.has('hidden');
    tag.text('label');
    expect(tag.getUnreadProperties()).toEqual([]);

    tag.resetReadTracking();
    expect(tag.getUnreadProperties()).toEqual([['hidden'], ['label']]);
  });

  test('deleted properties are not reported as unread', () => {
    const tag = new Tag({
      properties: {
        hidden: {},
        removed: {deleted: true},
      },
    });
    expect(tag.getUnreadProperties()).toEqual([['hidden']]);
  });

  test('all properties read returns empty array', () => {
    const tag = new Tag({
      properties: {
        hidden: {},
        label: {eq: 'Name'},
      },
    });
    tag.has('hidden');
    tag.text('label');
    expect(tag.getUnreadProperties()).toEqual([]);
  });

  test('numeric() marks as read', () => {
    const tag = new Tag({
      properties: {
        size: {eq: 42},
      },
    });
    tag.numeric('size');
    expect(tag.getUnreadProperties()).toEqual([]);
  });

  test('tag() marks as read', () => {
    const tag = new Tag({
      properties: {
        column: {
          properties: {
            width: {eq: 100},
          },
        },
      },
    });
    const col = tag.tag('column');
    expect(col).toBeDefined();
    // column is read, but width inside it is not
    expect(tag.getUnreadProperties()).toEqual([['column', 'width']]);
  });

  test('walk yields all descendant paths', () => {
    const tag = new Tag({
      properties: {
        viz: {
          eq: 'bar',
          properties: {
            stack: {},
            mode: {eq: 'normal'},
          },
        },
        label: {eq: 'Name'},
      },
    });
    const paths = [...tag.walk()].map(({path}) => path);
    expect(paths).toEqual([
      ['viz'],
      ['viz', 'stack'],
      ['viz', 'mode'],
      ['label'],
    ]);
  });

  test('walk skips deleted properties', () => {
    const tag = new Tag({
      properties: {
        visible: {},
        removed: {deleted: true},
      },
    });
    const paths = [...tag.walk()].map(({path}) => path);
    expect(paths).toEqual([['visible']]);
  });

  test('clone marks source tree as read', () => {
    const tag = new Tag({
      properties: {
        bar_chart: {
          properties: {
            stack: {},
            mode: {eq: 'normal'},
          },
        },
        label: {eq: 'Name'},
      },
    });
    expect(tag.getUnreadProperties()).toEqual([['bar_chart'], ['label']]);
    const barChart = tag.tag('bar_chart');
    barChart!.clone();
    // bar_chart and its entire subtree should be marked as read
    expect(tag.getUnreadProperties()).toEqual([['label']]);
  });
});

describe('Location tracking', () => {
  test('tag has location when parsed with source origin', () => {
    const origin: SourceOrigin = {
      url: 'file:///test.malloy',
      startLine: 10,
      startColumn: 0,
    };
    const session = new TagParser();
    session.parse('color=blue size=10', origin);
    const tag = session.finish();
    const color = tag.tag('color');
    expect(color).toBeDefined();
    expect(color!.location).toBeDefined();
    expect(color!.location!.url).toBe('file:///test.malloy');
    expect(color!.location!.range.start.line).toBeGreaterThanOrEqual(10);
  });

  test('tag has no location without source origin', () => {
    const session = new TagParser();
    session.parse('color=blue');
    const tag = session.finish();
    expect(tag.tag('color')?.location).toBeUndefined();
  });

  test('prefix is accounted for in column offset', () => {
    const origin: SourceOrigin = {
      url: 'file:///test.malloy',
      startLine: 5,
      startColumn: 0,
    };
    const session = new TagParser();
    // "# " prefix is 2 chars, stripped by parseAnnotation
    session.parseAnnotation('# color=blue', origin);
    const tag = session.finish();
    const color = tag.tag('color');
    expect(color).toBeDefined();
    expect(color!.location).toBeDefined();
    // Column should account for the stripped prefix
    expect(color!.location!.range.start.character).toBeGreaterThanOrEqual(2);
  });

  test('location preserved through clone', () => {
    const origin: SourceOrigin = {
      url: 'file:///test.malloy',
      startLine: 0,
      startColumn: 0,
    };
    const session = new TagParser();
    session.parse('name=test', origin);
    const tag = session.finish();
    const cloned = tag.clone();
    const nameTag = cloned.tag('name');
    expect(nameTag?.location).toBeDefined();
    expect(nameTag!.location!.url).toBe('file:///test.malloy');
  });

  test('multiple parse calls track separate origins', () => {
    const session = new TagParser();
    session.parse('color=blue', {
      url: 'file:///a.malloy',
      startLine: 1,
      startColumn: 0,
    });
    session.parse('size=10', {
      url: 'file:///b.malloy',
      startLine: 5,
      startColumn: 0,
    });
    const tag = session.finish();
    const color = tag.tag('color');
    const size = tag.tag('size');
    expect(color?.location?.url).toBe('file:///a.malloy');
    expect(size?.location?.url).toBe('file:///b.malloy');
  });
});
