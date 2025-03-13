/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {ChartTooltipEntry, MalloyVegaDataRecord} from '../types';
import {applyRenderer} from '../apply-renderer';
import type {NestField} from '../../data_tree';

type CustomTooltipGetterOptions = {
  explore: NestField;
  records: MalloyVegaDataRecord[];
};

export function getCustomTooltipEntries({
  explore,
  records,
}: CustomTooltipGetterOptions) {
  const customTooltipFields = explore.fields.filter(f => f.tag.has('tooltip'));
  const customEntries: ChartTooltipEntry['entries'] = [];
  customTooltipFields.forEach(f => {
    records.forEach(rec => {
      customEntries.push({
        label: f.name,
        value: () =>
          applyRenderer({
            dataColumn: rec.__row.column(f.name),
            tag: f.tag,
            customProps: {
              table: {
                shouldFillWidth: true,
                disableVirtualization: true,
                rowLimit: 20,
              },
            },
          }).renderValue,
        highlight: false,
        color: '',
        entryType: f.isNest() ? 'block' : 'list-item',
        ignoreHighlightState: true,
      });
    });
  });
  return customEntries;
}
