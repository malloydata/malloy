/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Annotations} from '../api/foundation/annotation';
import {DBMETA_ROUTE, dbmetaAnnotations, dbmetaProperty} from './dbmeta';

const descriptionOf = (description: string) =>
  new Annotations(dbmetaAnnotations({description}))
    .parseAsTag(DBMETA_ROUTE)
    .tag.text('description');

describe('dbmetaAnnotations', () => {
  it('writes the description on the dbmeta route', () => {
    expect(
      dbmetaAnnotations({description: 'Customer identifier.'})?.notes?.map(
        n => n.text
      )
    ).toEqual(['#(dbmeta) description = "Customer identifier."\n']);
  });

  it.each([
    'Customer identifier.',
    'Uses "active" status.',
    'First line.\nSecond line.',
    'A backslash \\ and a `backtick`.',
  ])('reads %p back exactly', description => {
    expect(descriptionOf(description)).toBe(description);
  });

  it('normalizes CRLF and trims surrounding whitespace', () => {
    expect(descriptionOf('  First line.\r\nSecond line.\n')).toBe(
      'First line.\nSecond line.'
    );
  });

  it.each([undefined, null, '', '   \n '])(
    'returns nothing for a missing or blank description (%p)',
    description => {
      expect(dbmetaAnnotations({description})).toBeUndefined();
    }
  );
});

describe('dbmetaProperty', () => {
  it('is an optional boolean, off unless set', () => {
    expect(dbmetaProperty).toMatchObject({
      name: 'dbmeta',
      type: 'boolean',
      optional: true,
    });
    expect(dbmetaProperty.default).toBeUndefined();
  });
});
