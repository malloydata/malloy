/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Scale} from 'vega';
import type {NestField} from '@/data_tree';

export const MEASURE_SERIES_LABEL_SCALE = 'measureSeriesLabel';

/**
 * For a measure-series legend the color-domain values are the raw measure
 * field names; this ordinal scale maps them to their `# label` so the legend
 * entries match the axis and tooltip. Keeping the labels in scale data (not
 * in a parsed expression) renders any label verbatim. An explicit empty
 * `# label=""` intentionally renders a blank legend entry, the same way it
 * hides an axis title. Domain and range are deduped in lockstep via a Map
 * keyed by field name: d3 dedupes an ordinal scale's domain but keeps its
 * range verbatim, so a measure repeated in the y channel would otherwise
 * shift the indices and map a later measure to the wrong label.
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
