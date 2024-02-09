/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {getExpressionTypeFromField} from './get_expression_type';

describe('getExpressionTypeFromField', () => {
  it('should return "tier" if the field has enumerations', () => {
    const mockField = {
      enumerations: [
        {
          label: 'answer',
          value: 42,
        },
      ],
    } as ILookmlModelExploreField;
    expect(getExpressionTypeFromField(mockField)).toEqual('tier');
  });

  it('should return "number" if the field is_numeric', () => {
    const mockField = {
      is_numeric: true,
    } as ILookmlModelExploreField;
    expect(getExpressionTypeFromField(mockField)).toEqual('number');
  });

  it('should return "number" if type is "number"', () => {
    const mockField = {
      type: 'number',
    } as ILookmlModelExploreField;
    expect(getExpressionTypeFromField(mockField)).toEqual('number');
  });

  describe('is_timeframe', () => {
    it('should return "date" if the field is_timeframe', () => {
      const mockField = {
        is_timeframe: true,
        type: 'field_type',
      } as ILookmlModelExploreField;
      expect(getExpressionTypeFromField(mockField)).toEqual('date');
    });

    it('should return "date_time" if the field is_timeframe, type is date_time', () => {
      const mockField = {
        is_timeframe: true,
        type: 'date_time',
      } as ILookmlModelExploreField;
      expect(getExpressionTypeFromField(mockField)).toEqual('date_time');
    });

    it('should return "date_time" if the field is_timeframe, type is date_hour', () => {
      const mockField = {
        is_timeframe: true,
        type: 'date_hour',
      } as ILookmlModelExploreField;
      expect(getExpressionTypeFromField(mockField)).toEqual('date_time');
    });

    it('should return "date" if type is date but is_timeframe is missing (custom fields)', () => {
      const mockField = {
        type: 'date',
      } as ILookmlModelExploreField;
      expect(getExpressionTypeFromField(mockField)).toEqual('date');
    });
  });

  it('should return "location" if the field is a "location" or "location_bin_level" type', () => {
    const mockField1 = {
      type: 'location',
    } as ILookmlModelExploreField;
    const mockField2 = {
      type: 'location_bin_level',
    } as ILookmlModelExploreField;
    expect(getExpressionTypeFromField(mockField1)).toEqual('location');
    expect(getExpressionTypeFromField(mockField2)).toEqual('location');
  });

  it('should return "string" by default', () => {
    const mockField = {} as ILookmlModelExploreField;
    expect(getExpressionTypeFromField(mockField)).toEqual('string');
  });

  it('should return number for number parameter (b/187940941, b/199507872)', () => {
    const mockField = {
      category: Category.parameter,
      type: 'number',
    } as ILookmlModelExploreField;
    expect(getExpressionTypeFromField(mockField)).toEqual('number');
  });
});
