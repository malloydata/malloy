/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ChartTooltipEntry, MalloyVegaDataRecord} from '@/component/types';
import {applyRenderer} from '@/component/renderer/apply-renderer';
import type {NestField} from '@/data_tree';

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
        label: f.getLabel(),
        value: () =>
          applyRenderer({
            dataColumn: rec.__row.column(f.name),
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
