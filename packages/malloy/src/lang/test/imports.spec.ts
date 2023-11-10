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
import './parse-expects';
import {TestTranslator, model} from './test-translator';
import escapeRegEx from 'lodash/escapeRegExp';

describe('import:', () => {
  test('simple source', () => {
    const docParse = new TestTranslator('import "child"');
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toEqual({urls: ['internal://test/langtests/child']});
    docParse.update({
      urls: {'internal://test/langtests/child': 'source: aa is a'},
    });
    expect(docParse).toTranslate();
    const aa = docParse.getSourceDef('aa');
    expect(aa).toBeDefined();
  });
  test('simple source with importBaseURL', () => {
    const docParse = new TestTranslator(
      'import "child"',
      'http://example.com/'
    );
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toEqual({urls: ['http://example.com/child']});
    docParse.update({
      urls: {'http://example.com/child': 'source: aa is a'},
    });
    expect(docParse).toTranslate();
    const aa = docParse.getSourceDef('aa');
    expect(aa).toBeDefined();
  });
  test('simple query', () => {
    const docParse = new TestTranslator('import "child"');
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toEqual({urls: ['internal://test/langtests/child']});
    docParse.update({
      urls: {
        'internal://test/langtests/child': 'query: aq is a->{ select: * }',
      },
    });
    expect(docParse).toTranslate();
    const aq = docParse.getQuery('aq');
    expect(aq).toBeDefined();
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
    expect(xr).toEqual({urls: ['internal://test/langtests/child']});
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
    const f = newSrc?.fields.find(f => f.name === 'b');
    expect(f?.type).toBe('struct');
    if (f?.type === 'struct') {
      const ss = f.structSource;
      expect(ss.type).toBe('query');
      if (ss.type === 'query') {
        expect(typeof ss.query.structRef).not.toBe('string');
      }
    }
  });
  test('missing import', () => {
    const docParse = new TestTranslator('import "child"');
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toEqual({urls: ['internal://test/langtests/child']});
    const reportedError = 'ENOWAY: No way to find your child';
    docParse.update({
      errors: {
        urls: {'internal://test/langtests/child': reportedError},
      },
    });
    docParse.translate();
    expect(docParse).translationToFailWith(
      new RegExp(escapeRegEx(reportedError))
    );
  });
  test('chained imports', () => {
    const docParse = new TestTranslator('import "child"');
    docParse.update({
      urls: {'internal://test/langtests/child': 'import "grandChild"'},
    });
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toEqual({urls: ['internal://test/langtests/grandChild']});
    docParse.update({
      urls: {'internal://test/langtests/grandChild': '// empty file'},
    });
    expect(docParse).toTranslate();
    const sources = docParse.translate().fromSources;
    expect(sources).toEqual([
      'internal://test/langtests/root.malloy',
      'internal://test/langtests/child',
      'internal://test/langtests/grandChild',
    ]);
  });
  test('relative imports', () => {
    const docParse = new TestTranslator('import "../parent.malloy"');
    expect(docParse).toParse();
    const xr = docParse.unresolved();
    expect(xr).toEqual({urls: ['internal://test/parent.malloy']});
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
    expect(xr).toEqual({urls: ['internal://test/parent.malloy']});
    docParse.update({
      urls: {
        'internal://test/parent.malloy': `
          source: aa is _db_.table('aTable') extend {
            dimension: astr is 'not legal beause astr exists'
          }`,
      },
    });
    expect(docParse).translationToFailWith("Cannot redefine 'astr'");
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
      expect(ms.structSource.type).toBe('query');
      if (ms.structSource.type === 'query') {
        const qs = ms.structSource.query.structRef;
        expect(typeof qs).not.toBe('string');
      }
    }
  });
  test('selective import of source', () => {
    const docParse = new TestTranslator('import { bb } from "child"');
    const xr = docParse.unresolved();
    expect(docParse).toParse();
    expect(xr).toEqual({urls: ['internal://test/langtests/child']});
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
    expect(xr).toEqual({urls: ['internal://test/langtests/child']});
    docParse.update({
      urls: {'internal://test/langtests/child': 'source: aa is a'},
    });
    expect(docParse).toTranslate();
    const bb = docParse.getSourceDef('bb');
    expect(bb).toBeDefined();
  });
  test('selective import of source, not found', () => {
    const doc = model`import { ${'bb'} } from "child"`;
    const xr = doc.translator.unresolved();
    expect(doc).toParse();
    expect(xr).toEqual({urls: ['internal://test/langtests/child']});
    doc.translator.update({
      urls: {
        'internal://test/langtests/child': 'source: aa is a',
      },
    });
    expect(doc.translator).translationToFailWith(
      "Cannot find 'bb', not imported"
    );
  });
  test('selective renamed import of source, not found', () => {
    const doc = model`import { cc is ${'bb'} } from "child"`;
    const xr = doc.translator.unresolved();
    expect(doc).toParse();
    expect(xr).toEqual({urls: ['internal://test/langtests/child']});
    doc.translator.update({
      urls: {
        'internal://test/langtests/child': 'source: aa is a',
      },
    });
    expect(doc.translator).translationToFailWith(
      "Cannot find 'bb', not imported"
    );
  });
  test('selective import of source, no-redefinition', () => {
    const doc = model`
      import { cc is ${'bb'} } from "child"
      import { cc is ${'bb'} } from "child"`;
    const xr = doc.translator.unresolved();
    expect(doc).toParse();
    expect(xr).toEqual({urls: ['internal://test/langtests/child']});
    doc.translator.update({
      urls: {
        'internal://test/langtests/child': 'source: bb is a',
      },
    });
    expect(doc.translator).translationToFailWith("Cannot redefine 'cc'");
  });
});
