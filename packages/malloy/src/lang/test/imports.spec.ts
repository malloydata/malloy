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
import {isJoined} from '../../model';
import './parse-expects';
import {TestTranslator, errorMessage, model} from './test-translator';
import escapeRegEx from 'lodash/escapeRegExp';

describe('import:', () => {
  test('simple source', () => {
    const docParse = new TestTranslator('import "child"');
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toMatchObject({urls: ['internal://test/langtests/child']});
    docParse.update({
      urls: {'internal://test/langtests/child': 'source: aa is a'},
    });
    expect(docParse).toTranslate();
    const aa = docParse.getSourceDef('aa');
    expect(aa).toBeDefined();
    expect(docParse.translate().modelDef?.dependencies).toMatchObject({
      'internal://test/langtests/child': {},
    });
  });
  test('simple source with importBaseURL', () => {
    const docParse = new TestTranslator(
      'import "child"',
      'http://example.com/'
    );
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toMatchObject({urls: ['http://example.com/child']});
    docParse.update({
      urls: {'http://example.com/child': 'source: aa is a'},
    });
    expect(docParse).toTranslate();
    const aa = docParse.getSourceDef('aa');
    expect(aa).toBeDefined();
    expect(docParse.translate().modelDef?.dependencies).toMatchObject({
      'http://example.com/child': {},
    });
  });
  test('simple query', () => {
    const docParse = new TestTranslator('import "child"');
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toMatchObject({urls: ['internal://test/langtests/child']});
    docParse.update({
      urls: {
        'internal://test/langtests/child': 'query: aq is a->{ select: * }',
      },
    });
    expect(docParse).toTranslate();
    const aq = docParse.getQuery('aq');
    expect(aq).toBeDefined();
    expect(docParse.translate().modelDef?.dependencies).toMatchObject({
      'internal://test/langtests/child': {},
    });
  });
  test('query based source with named structref', () => {
    const docParse = new TestTranslator(`
import "child"
source: newSrc is a extend {
  join_one: b is botProjQSrc on b.astr = astr
}
`);
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toMatchObject({urls: ['internal://test/langtests/child']});
    docParse.update({
      urls: {
        'internal://test/langtests/child': `
source: bottomSrc is a
query: botProjQ is bottomSrc -> { select: * }
source: botProjQSrc is botProjQ
`,
      },
    });
    expect(docParse).toTranslate();
    const newSrc = docParse.getSourceDef('newSrc');
    const maybeField = newSrc?.fields.find(f => f.name === 'b');
    expect(maybeField).toBeDefined();
    if (maybeField && isJoined(maybeField)) {
      expect(maybeField.type).toBe('query_source');
      if (maybeField.type === 'query_source') {
        expect(typeof maybeField.query.structRef).not.toBe('string');
      }
    } else {
      fail('Expected maybeField to be a joined field');
    }
  });
  test('missing import', () => {
    const docParse = new TestTranslator('import "child"');
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toMatchObject({urls: ['internal://test/langtests/child']});
    const reportedError = 'ENOWAY: No way to find your child';
    docParse.update({
      errors: {
        urls: {'internal://test/langtests/child': reportedError},
      },
    });
    docParse.translate();
    expect(docParse).toLog(
      errorMessage(new RegExp(escapeRegEx(reportedError)))
    );
  });
  test('chained imports', () => {
    const docParse = new TestTranslator('import "child"');
    docParse.update({
      urls: {'internal://test/langtests/child': 'import "grandChild"'},
    });
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toMatchObject({urls: ['internal://test/langtests/grandChild']});
    docParse.update({
      urls: {'internal://test/langtests/grandChild': '// empty file'},
    });
    expect(docParse).toTranslate();
    const translated = docParse.translate();
    const sources = translated.fromSources;
    expect(sources).toEqual([
      'internal://test/langtests/root.malloy',
      'internal://test/langtests/child',
      'internal://test/langtests/grandChild',
    ]);
    expect(translated.modelDef?.dependencies).toMatchObject({
      'internal://test/langtests/child': {
        'internal://test/langtests/grandChild': {},
      },
    });
    const newDependencies = docParse.newlyTranslatedDependencies();
    expect(newDependencies).toMatchObject([
      {url: 'internal://test/langtests/child', modelDef: {}},
      {url: 'internal://test/langtests/grandChild', modelDef: {}},
    ]);
    const child = docParse.translatorForDependency(
      'internal://test/langtests/child'
    );
    expect(child?.translate().modelDef?.dependencies).toMatchObject({
      'internal://test/langtests/grandChild': {},
    });
  });
  test('relative imports', () => {
    const docParse = new TestTranslator('import "../parent.malloy"');
    expect(docParse).toParse();
    const xr = docParse.unresolved();
    expect(xr).toMatchObject({urls: ['internal://test/parent.malloy']});
    docParse.update({
      urls: {
        'internal://test/parent.malloy': "source: aa is _db_.table('aTable')",
      },
    });
    expect(docParse).toTranslate();
  });
  test('relative imports with errors', () => {
    const docParse = new TestTranslator('import "../parent.malloy"');
    expect(docParse).toParse();
    const xr = docParse.unresolved();
    expect(xr).toMatchObject({urls: ['internal://test/parent.malloy']});
    docParse.update({
      urls: {
        'internal://test/parent.malloy': `
          source: aa is _db_.table('aTable') extend {
            dimension: astr is 'not legal beause astr exists'
          }`,
      },
    });
    expect(docParse).toLog(errorMessage("Cannot redefine 'astr'"));
  });
  test('source references expanded when not exported', () => {
    const srcFiles = {
      'internal://test/langtests/middle': `
        import "bottom"
        // in m4 source: NAME is SRC -> { QUERY } wasn't parsing
        query: q is bottomSrc -> { group_by: astr }
        source: midSrc is q
      `,
      'internal://test/langtests/bottom':
        "source: bottomSrc is _db_.table('aTable')",
    };
    const fullModel = new TestTranslator(`
      import "middle"
    `);
    fullModel.update({urls: srcFiles});
    expect(fullModel).toTranslate();
    const ms = fullModel.getSourceDef('midSrc');
    expect(ms).toBeDefined();
    if (ms) {
      expect(ms.type).toBe('query_source');
      if (ms.type === 'query_source') {
        const qs = ms.query.structRef;
        expect(typeof qs).not.toBe('string');
      }
    }
  });
  test('selective import of source', () => {
    const docParse = new TestTranslator('import { bb } from "child"');
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toMatchObject({urls: ['internal://test/langtests/child']});
    docParse.update({
      urls: {
        'internal://test/langtests/child': 'source: aa is a; source: bb is a',
      },
    });
    expect(docParse).toTranslate();
    const bb = docParse.getSourceDef('bb');
    expect(bb).toBeDefined();
    const aa = docParse.getSourceDef('aa');
    expect(aa).toBeUndefined();
  });
  test('renaming import of source', () => {
    const docParse = new TestTranslator('import { bb is aa } from "child"');
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toMatchObject({urls: ['internal://test/langtests/child']});
    docParse.update({
      urls: {'internal://test/langtests/child': 'source: aa is a'},
    });
    expect(docParse).toTranslate();
    const bb = docParse.getSourceDef('bb');
    expect(bb).toBeDefined();
  });
  test('renaming import sets as property, preserves name', () => {
    // When renaming on import, 'as' should be the new name
    // 'name' should be preserved from the original source
    const docParse = new TestTranslator(
      'import { renamed is original } from "child"'
    );
    docParse.update({
      urls: {'internal://test/langtests/child': 'source: original is a'},
    });
    expect(docParse).toTranslate();
    const renamed = docParse.getSourceDef('renamed');
    expect(renamed).toBeDefined();
    if (renamed) {
      expect(renamed.as).toBe('renamed');
      // name is preserved from the original source (comes from 'a' which is table)
      expect(renamed.name).toBe('a');
    }
  });
  test('selective import of source, not found', () => {
    const doc = model`import { ${'bb'} } from "child"`;
    const xr = doc.translator.unresolved();
    expect(doc).toParse();
    expect(xr).toMatchObject({urls: ['internal://test/langtests/child']});
    doc.translator.update({
      urls: {
        'internal://test/langtests/child': 'source: aa is a',
      },
    });
    expect(doc.translator).toLog(
      errorMessage("Cannot find 'bb', not imported")
    );
  });
  test('selective renamed import of source, not found', () => {
    const doc = model`import { cc is ${'bb'} } from "child"`;
    const xr = doc.translator.unresolved();
    expect(doc).toParse();
    expect(xr).toMatchObject({urls: ['internal://test/langtests/child']});
    doc.translator.update({
      urls: {
        'internal://test/langtests/child': 'source: aa is a',
      },
    });
    expect(doc.translator).toLog(
      errorMessage("Cannot find 'bb', not imported")
    );
  });
  test('selective import of source, no-redefinition', () => {
    const doc = model`
      import { cc is ${'bb'} } from "child"
      import { cc is ${'bb'} } from "child"`;
    const xr = doc.translator.unresolved();
    expect(doc).toParse();
    expect(xr).toMatchObject({urls: ['internal://test/langtests/child']});
    doc.translator.update({
      urls: {
        'internal://test/langtests/child': 'source: bb is a',
      },
    });
    expect(doc.translator).toLog(errorMessage("Cannot redefine 'cc'"));
  });

  describe('sourceRegistry across imports', () => {
    test('persistent base propagates through non-persistent import chain', () => {
      // grandchild: persistent base
      // child: non-persistent, extends base
      // parent: non-persistent, extends child's source
      // Result: parent's sourceRegistry should contain the persistent base
      const docParse = new TestTranslator(`
        import "child"
        source: source_c is source_b extend { dimension: c_field is 'c' }
      `);
      docParse.update({
        urls: {
          'internal://test/langtests/child': `
            import "grandchild"
            source: source_b is source_a extend { dimension: b_field is 'b' }
          `,
          'internal://test/langtests/grandchild': `
            #@ persist
            source: source_a is a -> { group_by: astr }
          `,
        },
      });

      expect(docParse).toTranslate();
      const modelDef = docParse.translate().modelDef;
      expect(modelDef).toBeDefined();

      // source_c is in namespace (defined locally, non-persistent)
      const source_c = docParse.getSourceDef('source_c');
      expect(source_c).toBeDefined();

      // source_b is in namespace (imported, non-persistent)
      const source_b = docParse.getSourceDef('source_b');
      expect(source_b).toBeDefined();

      // source_a is NOT in namespace (hidden persistent dependency)
      const source_a = docParse.getSourceDef('source_a');
      expect(source_a).toBeUndefined();

      // sourceRegistry should contain source_a as hidden persistent dependency
      if (modelDef) {
        const source_a_id = 'source_a@internal://test/langtests/grandchild';
        const source_a_value = modelDef.sourceRegistry[source_a_id];
        expect(source_a_value).toBeDefined();
        if (source_a_value) {
          // Hidden dependency should be actual SourceDef, not a reference
          expect(source_a_value.entry.type).toBe('query_source');
        }
      }
    });
  });
});
