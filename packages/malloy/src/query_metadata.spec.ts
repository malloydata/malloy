/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  queryMetadataBag,
  queryMetadataComment,
  queryMetadataProblems,
  validateQueryMetadata,
} from './query_metadata';

describe('queryMetadataProblems / validateQueryMetadata', () => {
  it('accepts a conforming bag (mixed case allowed)', () => {
    const meta = {
      CostCenter: 'Eng',
      team_name: 'finance',
      application_name: 'My-App',
    };
    expect(queryMetadataProblems(meta)).toEqual([]);
    expect(() => validateQueryMetadata(meta)).not.toThrow();
  });

  it('accepts an empty bag', () => {
    expect(queryMetadataProblems({})).toEqual([]);
  });

  it('rejects property names outside [A-Za-z0-9_]', () => {
    expect(queryMetadataProblems({'team.name': 'v'})).toHaveLength(1);
    expect(queryMetadataProblems({'a-b': 'v'})).toHaveLength(1);
    expect(() => validateQueryMetadata({'a b': 'v'})).toThrow(
      /Invalid query metadata/
    );
  });

  it('rejects values with a double-quote or non-printable-ASCII', () => {
    expect(queryMetadataProblems({k: 'a"b'})).toHaveLength(1);
    expect(queryMetadataProblems({k: 'a\nb'})).toHaveLength(1);
    expect(queryMetadataProblems({k: 'a\r'})).toHaveLength(1);
    expect(queryMetadataProblems({k: 'say "hi"'})).toHaveLength(1);
  });

  it('rejects over-long values and too many properties', () => {
    expect(queryMetadataProblems({k: 'x'.repeat(300)})).toHaveLength(1);
    const many: Record<string, string> = {};
    for (let i = 0; i < 100; i++) many[`k${i}`] = 'v';
    expect(queryMetadataProblems(many)).not.toHaveLength(0);
  });
});

describe('queryMetadataBag', () => {
  it('returns the bag when non-empty', () => {
    expect(queryMetadataBag({team: 'fin'})).toEqual({team: 'fin'});
  });

  it('returns undefined for an empty bag', () => {
    expect(queryMetadataBag({})).toBeUndefined();
  });

  it('throws on an invalid bag', () => {
    expect(() => queryMetadataBag({'bad key': 'v'})).toThrow();
  });
});

describe('queryMetadataComment', () => {
  it('serializes to a single leading comment line', () => {
    expect(queryMetadataComment({env: 'prod', application_name: 'app'})).toBe(
      '-- env="prod" application_name="app"\n'
    );
  });

  it('returns the empty string for an empty bag', () => {
    expect(queryMetadataComment({})).toBe('');
  });

  it('throws on an invalid bag rather than emitting an unsafe comment', () => {
    expect(() => queryMetadataComment({k: 'a"b'})).toThrow();
  });
});
