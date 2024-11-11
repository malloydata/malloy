/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Explore} from '@malloydata/malloy';
import {
  ChartTooltipEntry,
  MalloyVegaDataRecord,
  RenderResultMetadata,
} from '../types';
import {applyRenderer} from '../apply-renderer';

type CustomTooltipGetterOptions = {
  explore: Explore;
  records: MalloyVegaDataRecord[];
  metadata: RenderResultMetadata;
};

export function getCustomTooltipEntries({
  explore,
  records,
  metadata,
}: CustomTooltipGetterOptions) {
  const customTooltipFields = explore.allFields.filter(f =>
    f.tagParse().tag.has('tooltip')
  );
  const customEntries: ChartTooltipEntry['entries'] = [];
  customTooltipFields.forEach(f => {
    if (f.isAtomicField() || f.isExploreField()) {
      records.forEach(rec => {
        customEntries.push({
          label: f.name,
          value: () =>
            applyRenderer({
              field: f,
              dataColumn: rec.__source.__malloyDataRecord.cell(f.name),
              resultMetadata: metadata,
              tag: f.tagParse().tag,
            }).renderValue,
          highlight: false,
          color: '',
          entryType: f.isExploreField() ? 'block' : 'list-item',
          ignoreHighlightState: true,
        });
      });
    }
  });
  return customEntries;
}
