/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {expressionFunction} from 'vega';
import {renderNumericField} from '../render-numeric-field';
import type {BrushData} from '../result-store/result-store';
import {renderTimeString} from '../../util';
import type {NestField} from '../../data_tree';

if (!expressionFunction('renderMalloyNumber')) {
  expressionFunction(
    'renderMalloyNumber',
    (explore: NestField, fieldPath: string, value: number) => {
      if (explore) {
        const field = explore.fieldAt(fieldPath);
        return field.isAtomic()
          ? renderNumericField(field, value)
          : String(value);
      }
      return String(value);
    }
  );
}

if (!expressionFunction('renderMalloyTime')) {
  expressionFunction(
    'renderMalloyTime',
    (explore: NestField, fieldPath: string, value: number) => {
      if (explore) {
        const field = explore.fieldAt(fieldPath);
        if (field.isTime())
          return renderTimeString(
            new Date(value),
            field.isDate(),
            field.timeframe
          );
      }
      return String(value);
    }
  );
}

if (!expressionFunction('getMalloyBrush')) {
  expressionFunction(
    'getMalloyBrush',
    (brushArray: BrushData[], fieldRefId: string | string[], type?: string) => {
      const fieldRefs = Array.isArray(fieldRefId) ? fieldRefId : [fieldRefId];
      return (
        brushArray.find(brush => {
          const isField = fieldRefs.includes(brush.fieldRefId);
          const isType = type ? brush.type === type : true;
          return isField && isType;
        })?.value ?? null
      );
    }
  );
}

if (!expressionFunction('getMalloyMeasureBrushes')) {
  expressionFunction(
    'getMalloyMeasureBrushes',
    (
      brushArray: BrushData[],
      fieldRefIds: string[],
      refsToFieldMap: Record<string, string>
    ) =>
      brushArray
        .filter(brush => fieldRefIds.includes(brush.fieldRefId))
        .map(brush => ({
          ...brush,
          fieldPath: refsToFieldMap[brush.fieldRefId],
        })) ?? []
  );
}

if (!expressionFunction('snapValue')) {
  expressionFunction(
    'snapValue',
    (range: [number, number], stepCt: number, valueToSnap: number) => {
      const min = range[0];
      const max = range[1];
      const stepSize = (max - min) / stepCt;

      // Round the value to the nearest step size
      const snappedValue = Math.round(valueToSnap / stepSize) * stepSize;
      return snappedValue;
    }
  );
}
