/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  APPLICATION_LABEL_KEY,
  labelsWithApplication,
  validateQueryTags,
} from './query_tags';

describe('validateQueryTags', () => {
  it('accepts conforming tags (case and separators allowed)', () => {
    expect(
      validateQueryTags({
        applicationName: 'My-App',
        labels: {'CostCenter': 'Eng', 'team.name': 'finance'},
      })
    ).toEqual([]);
  });

  it('accepts empty tags', () => {
    expect(validateQueryTags({})).toEqual([]);
    expect(validateQueryTags({labels: {}})).toEqual([]);
  });

  it('rejects control characters in keys and values', () => {
    expect(validateQueryTags({labels: {k: 'a\nb'}})).toHaveLength(1);
    expect(validateQueryTags({labels: {'a\tb': 'v'}})).toHaveLength(1);
    expect(validateQueryTags({applicationName: 'a\r'})).toHaveLength(1);
  });

  it('rejects an empty label key', () => {
    expect(validateQueryTags({labels: {'': 'v'}})).toContain('empty label key');
  });

  it('rejects over-long values and too many labels', () => {
    expect(validateQueryTags({labels: {k: 'x'.repeat(300)}})).toHaveLength(1);
    const many: Record<string, string> = {};
    for (let i = 0; i < 100; i++) many[`k${i}`] = 'v';
    expect(validateQueryTags({labels: many})).not.toHaveLength(0);
  });
});

describe('labelsWithApplication', () => {
  it('folds applicationName in under the reserved key', () => {
    expect(
      labelsWithApplication({applicationName: 'app', labels: {team: 'fin'}})
    ).toEqual({team: 'fin', [APPLICATION_LABEL_KEY]: 'app'});
  });

  it('does not overwrite an explicit application label', () => {
    expect(
      labelsWithApplication({
        applicationName: 'app',
        labels: {[APPLICATION_LABEL_KEY]: 'explicit'},
      })
    ).toEqual({[APPLICATION_LABEL_KEY]: 'explicit'});
  });

  it('returns undefined when there is nothing to apply', () => {
    expect(labelsWithApplication({})).toBeUndefined();
    expect(labelsWithApplication({labels: {}})).toBeUndefined();
  });

  it('returns labels alone when there is no applicationName', () => {
    expect(labelsWithApplication({labels: {team: 'fin'}})).toEqual({
      team: 'fin',
    });
  });
});
