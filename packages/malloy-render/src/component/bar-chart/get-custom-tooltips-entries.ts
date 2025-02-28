/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChartTooltipEntry,
  RenderResultMetadata,
  MalloyVegaDataRecord,
} from '../types';
import {applyRenderer} from '../apply-renderer';
import {getCell, getNestFields, isNest, NestFieldInfo, tagFor} from '../util';

type CustomTooltipGetterOptions = {
  explore: NestFieldInfo;
  records: MalloyVegaDataRecord[];
  metadata: RenderResultMetadata;
};

export function getCustomTooltipEntries({
  explore,
  records,
  metadata,
}: CustomTooltipGetterOptions) {
  const customTooltipFields = getNestFields(explore).filter(f =>
    tagFor(f).has('tooltip')
  );
  const customEntries: ChartTooltipEntry['entries'] = [];
  customTooltipFields.forEach(f => {
    const parent = metadata.fields.get(f)!.parent!.field;
    records.forEach(rec => {
      customEntries.push({
        label: f.name,
        value: () =>
          applyRenderer({
            field: f,
            dataColumn: getCell(
              parent,
              rec.__source.__malloyDataRecord,
              f.name
            ),
            resultMetadata: metadata,
            tag: tagFor(f),
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
        entryType: isNest(f) ? 'block' : 'list-item',
        ignoreHighlightState: true,
      });
    });
  });
  return customEntries;
}
