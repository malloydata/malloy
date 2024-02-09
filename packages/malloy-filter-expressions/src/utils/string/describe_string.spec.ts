/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterModel} from '../../types';
import {i18nInit} from '../i18n';
import {describeString} from './describe_string';

describe('String summary', () => {
  beforeEach(() => i18nInit());

  it('returns empty string for an invalid item type', () => {
    const item: FilterModel = {
      'id': '1',
      'type': 'what',
      'is': false,
    };
    expect(describeString(item)).toBe('');
  });

  describe('when type of filter is `match`', () => {
    describe('and is including', () => {
      describe('and values do not contain special characters', () => {
        it('returns a string containing all values, unquoted, and separated by `or`', () => {
          const item: FilterModel = {
            'is': true,
            'id': '1',
            'type': 'match',
            'value': ['value1', 'value2'],
          };
          expect(describeString(item)).toBe('is value1 or value2');
        });
      });

      describe('and values contain special characters', () => {
        it('returns a string containing all values, unquoted, and separated by `or`', () => {
          const item: FilterModel = {
            'is': true,
            'id': '1',
            'type': 'match',
            'value': ['value1"', 'value2,'],
          };
          expect(describeString(item)).toBe('is "value1"" or "value2,"');
        });
      });
    });

    describe('and is excluding', () => {
      describe('and values do not contain special characters', () => {
        it('returns a string containing all values, unquoted, and separated by `or`', () => {
          const item: FilterModel = {
            'is': false,
            'id': '1',
            'type': 'match',
            'value': ['value1', 'value2'],
          };
          expect(describeString(item)).toBe('is not value1 or value2');
        });
      });

      describe('and values contain special characters', () => {
        it('returns a string containing all values, unquoted, and separated by `or`', () => {
          const item: FilterModel = {
            'is': false,
            'id': '1',
            'type': 'match',
            'value': ['value1"', 'value2,'],
          };
          expect(describeString(item)).toBe('is not "value1"" or "value2,"');
        });
      });
    });
  });
});
