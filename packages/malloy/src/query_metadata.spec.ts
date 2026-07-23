/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  APPLICATION_LABEL_KEY,
  queryMetadataComment,
  queryMetadataLabels,
  queryMetadataProblems,
  validateQueryMetadata,
} from './query_metadata';

describe('queryMetadataProblems / validateQueryMetadata', () => {
  it('accepts a conforming bag (mixed case allowed)', () => {
    const meta = {
      applicationName: 'My-App',
      labels: {CostCenter: 'Eng', team_name: 'finance'},
    };
    expect(queryMetadataProblems(meta)).toEqual([]);
    expect(() => validateQueryMetadata(meta)).not.toThrow();
  });

  it('accepts an empty bag', () => {
    expect(queryMetadataProblems({})).toEqual([]);
    expect(queryMetadataProblems({labels: {}})).toEqual([]);
  });

  it('rejects label keys outside [A-Za-z0-9_]', () => {
    expect(queryMetadataProblems({labels: {'team.name': 'v'}})).toHaveLength(1);
    expect(queryMetadataProblems({labels: {'a-b': 'v'}})).toHaveLength(1);
    expect(() => validateQueryMetadata({labels: {'a b': 'v'}})).toThrow(
      /Invalid query metadata/
    );
  });

  it('rejects values with a double-quote or non-printable-ASCII', () => {
    expect(queryMetadataProblems({labels: {k: 'a"b'}})).toHaveLength(1);
    expect(queryMetadataProblems({labels: {k: 'a\nb'}})).toHaveLength(1);
    expect(queryMetadataProblems({applicationName: 'a\r'})).toHaveLength(1);
    expect(queryMetadataProblems({applicationName: 'say "hi"'})).toHaveLength(
      1
    );
  });

  it('rejects over-long values and too many properties', () => {
    expect(queryMetadataProblems({labels: {k: 'x'.repeat(300)}})).toHaveLength(
      1
    );
    const many: Record<string, string> = {};
    for (let i = 0; i < 100; i++) many[`k${i}`] = 'v';
    expect(queryMetadataProblems({labels: many})).not.toHaveLength(0);
  });
});

describe('queryMetadataLabels', () => {
  it('folds applicationName in under the reserved key', () => {
    expect(
      queryMetadataLabels({applicationName: 'app', labels: {team: 'fin'}})
    ).toEqual({team: 'fin', [APPLICATION_LABEL_KEY]: 'app'});
  });

  it('does not overwrite an explicit application label', () => {
    expect(
      queryMetadataLabels({
        applicationName: 'app',
        labels: {[APPLICATION_LABEL_KEY]: 'explicit'},
      })
    ).toEqual({[APPLICATION_LABEL_KEY]: 'explicit'});
  });

  it('returns undefined when there is nothing to apply', () => {
    expect(queryMetadataLabels({})).toBeUndefined();
    expect(queryMetadataLabels({labels: {}})).toBeUndefined();
  });

  it('throws on an invalid bag', () => {
    expect(() => queryMetadataLabels({labels: {'bad key': 'v'}})).toThrow();
  });
});

describe('queryMetadataComment', () => {
  it('serializes to a single leading comment line', () => {
    expect(
      queryMetadataComment({applicationName: 'app', labels: {env: 'prod'}})
    ).toBe('-- env="prod" application="app"\n');
  });

  it('returns the empty string when there is nothing to apply', () => {
    expect(queryMetadataComment({})).toBe('');
  });

  it('throws on an invalid bag rather than emitting an unsafe comment', () => {
    expect(() => queryMetadataComment({labels: {k: 'a"b'}})).toThrow();
  });
});
