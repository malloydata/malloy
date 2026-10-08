/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Annotations} from '../api/foundation/annotation';
import {DBMETA_ROUTE, dbmetaAnnotations, dbmetaProperty} from './dbmeta';

const descriptionOf = (description: string) =>
  new Annotations(dbmetaAnnotations({description}).annotations)
    .parseAsTag(DBMETA_ROUTE)
    .tag.text('description');

describe('dbmetaAnnotations', () => {
  it('returns a fragment to spread, with the description on the dbmeta route', () => {
    expect(dbmetaAnnotations({description: 'Customer identifier.'})).toEqual({
      annotations: {
        notes: [
          {
            text: '#(dbmeta) description="Customer identifier."\n',
            at: expect.anything(),
          },
        ],
      },
    });
  });

  it.each([
    'Customer identifier.',
    'Uses "active" status.',
    'First line.\nSecond line.',
    'Windows line.\r\nEnding.',
    'Lone\rreturn.',
    'A backslash \\ and a `backtick`.',
  ])('reads %p back exactly', description => {
    expect(descriptionOf(description)).toBe(description);
  });

  it('trims surrounding whitespace', () => {
    expect(descriptionOf('  Padded.\n')).toBe('Padded.');
  });

  it.each([undefined, null, '', '   \n '])(
    'returns an empty fragment for a missing or blank description (%p)',
    description => {
      expect(dbmetaAnnotations({description})).toEqual({});
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
