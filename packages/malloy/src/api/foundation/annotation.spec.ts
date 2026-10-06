/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Annotations} from './annotation';
import type {Note} from '../../model';

const at: Note['at'] = {
  url: 'test://x',
  range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
};
const note = (text: string): Note => ({text, at});

describe('Annotations API class', () => {
  describe('forRoute', () => {
    test('with a route filters to that route', () => {
      const a = new Annotations({
        notes: [note('# tag'), note('#(docs) one'), note('#(docs) two')],
      });
      expect(a.forRoute('docs').map(n => n.content)).toEqual(['one', 'two']);
    });

    test('no argument enumerates every annotation, each carrying its route', () => {
      const a = new Annotations({
        notes: [note('# tag'), note('#(docs) hello'), note('#! flag')],
      });
      const all = a.forRoute();
      expect(all.map(n => n.route)).toEqual(['', 'docs', '!']);
    });

    test('no argument reaches malformed-prefix annotations that filtering excludes', () => {
      const a = new Annotations({
        notes: [note('#malformed'), note('#(docs) ok')],
      });
      expect(a.forRoute('docs').map(n => n.text)).toEqual(['#(docs) ok']);
      expect(a.forRoute().map(n => n.text)).toContain('#malformed');
    });

    test('undefined annotations yields empty for both forms', () => {
      const a = new Annotations(undefined);
      expect(a.forRoute()).toEqual([]);
      expect(a.forRoute('docs')).toEqual([]);
    });
  });

  describe('texts', () => {
    test('no argument returns every annotation text', () => {
      const a = new Annotations({
        notes: [note('# tag'), note('#(docs) hello')],
      });
      expect(a.texts()).toEqual(['# tag', '#(docs) hello']);
    });

    test('with a route filters to that route', () => {
      const a = new Annotations({
        notes: [note('# tag'), note('#(docs) hello')],
      });
      expect(a.texts('docs')).toEqual(['#(docs) hello']);
    });
  });

  describe('parseAsTag', () => {
    test('default route is the MOTLY tag route', () => {
      const a = new Annotations({notes: [note('# size=large')]});
      expect(a.parseAsTag().tag.text('size')).toBe('large');
    });

    test('an explicit route parses that route', () => {
      const a = new Annotations({notes: [note('#(viz) chart=bar')]});
      expect(a.parseAsTag('viz').tag.text('chart')).toBe('bar');
    });
  });
});

describe('Annotations.documentation', () => {
  const dbmeta = '#(dbmeta) description = "From the database."\n';

  it('returns doc strings written in the model', () => {
    const a = new Annotations({notes: [note('#" Written in the model.\n')]});
    expect(a.documentation()).toBe('Written in the model.');
  });

  it('prefers written doc strings over the database description', () => {
    const a = new Annotations({
      inherits: {notes: [note(dbmeta)]},
      notes: [note('#" Written in the model.\n')],
    });
    expect(a.documentation()).toBe('Written in the model.');
  });

  it('falls back to the database description', () => {
    const a = new Annotations({notes: [note(dbmeta)]});
    expect(a.documentation()).toBe('From the database.');
  });

  it('joins several doc strings in order', () => {
    const a = new Annotations({
      inherits: {notes: [note('#" From the base.\n')]},
      notes: [note('#" From the extension.\n')],
    });
    expect(a.documentation()).toBe('From the base.\nFrom the extension.');
  });

  it('ignores other routes, and is undefined with nothing to show', () => {
    expect(
      new Annotations({
        notes: [note('# bar_chart\n'), note('#(doc) x\n')],
      }).documentation()
    ).toBeUndefined();
    expect(new Annotations(undefined).documentation()).toBeUndefined();
  });
});
