/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {getUnitLabel} from './get_unit_label';

describe('Returns a label', () => {
  beforeEach(() =>
    i18nInit().catch(e => {
      throw new Error(e);
    })
  );

  it('should return a valid plural unit label', () => {
    expect(getUnitLabel('week', 3)).toBe('weeks');
  });
  it('should return the unit if value is 1', () => {
    expect(getUnitLabel('month', 1)).toBe('month');
  });

  it('should return the unit if unit is not found', () => {
    expect(getUnitLabel('something else', 2)).toBe('something else');
  });
});
