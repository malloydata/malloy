/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Scale} from 'vega';
import type {NestField} from '@/data_tree';

export const MEASURE_SERIES_LABEL_SCALE = 'measureSeriesLabel';

/**
 * Maps the measure-series legend's domain (raw measure field names) to each
 * field's `# label`. Labels live in scale data so they render verbatim: an
 * explicit `# label=""` deliberately shows a blank legend entry, the same
 * way it hides an axis title. Domain and range dedupe in lockstep because
 * d3 dedupes an ordinal scale's domain but not its range; a repeated y
 * measure would otherwise shift later labels onto the wrong measure.
 */
export function getMeasureSeriesLabelScale(
  explore: NestField,
  yFieldPaths: string[]
): Scale {
  const labelByName = new Map<string, string>();
  for (const fieldPath of yFieldPaths) {
    const field = explore.fieldAt(fieldPath);
    labelByName.set(field.name, field.getLabel());
  }
  return {
    name: MEASURE_SERIES_LABEL_SCALE,
    type: 'ordinal',
    domain: [...labelByName.keys()],
    range: [...labelByName.values()],
  };
}
