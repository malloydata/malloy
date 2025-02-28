/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Tag} from '@malloydata/malloy-tag';
import {RenderResultMetadata} from './types';
import {
  getCellValue,
  isAtomic,
  isDate,
  isNest,
  isTimestamp,
  NestFieldInfo,
  tagFor,
  valueIsNull,
  valueIsNumber,
  valueIsString,
} from './util';
import {JSXElement} from 'solid-js';
import {renderNumericField} from './render-numeric-field';
import {renderLink} from './render-link';
import {Chart} from './chart/chart';
import MalloyTable from './table/table';
import {renderList} from './render-list';
import {renderImage} from './render-image';
import {Dashboard} from './dashboard/dashboard';
// import {LegacyChart} from './legacy-charts/legacy_chart';
import {renderTime} from './render-time';
import * as Malloy from '@malloydata/malloy-interfaces';

export type RendererProps = {
  field: Malloy.DimensionInfo;
  dataColumn: Malloy.Cell;
  resultMetadata: RenderResultMetadata;
  tag: Tag;
  customProps?: Record<string, Record<string, unknown>>;
};

const RENDER_TAG_LIST = [
  'link',
  'image',
  'cell',
  'list',
  'list_detail',
  'bar_chart',
  'line_chart',
  'dashboard',
  'scatter_chart',
  'shape_map',
  'segment_map',
];

const CHART_TAG_LIST = ['bar_chart', 'line_chart'];

export function shouldRenderChartAs(tag: Tag) {
  const tagNamesInOrder = Object.keys(tag.properties ?? {}).reverse();
  return tagNamesInOrder.find(name => CHART_TAG_LIST.includes(name));
}

export function shouldRenderAs(f: Malloy.DimensionInfo, tagOverride?: Tag) {
  const tag = tagOverride ?? tagFor(f);
  const tagNamesInOrder = Object.keys(tag.properties ?? {}).reverse();
  for (const tagName of tagNamesInOrder) {
    if (RENDER_TAG_LIST.includes(tagName)) {
      if (['list', 'list_detail'].includes(tagName)) return 'list';
      if (['bar_chart', 'line_chart'].includes(tagName)) return 'chart';
      return tagName;
    }
  }

  if (isAtomic(f)) return 'cell';
  return 'table';
}

export const NULL_SYMBOL = '∅';

export function applyRenderer(props: RendererProps) {
  const {field, dataColumn, resultMetadata, customProps = {}} = props;
  const renderAs = resultMetadata.fields.get(field)!.renderAs;
  let renderValue: JSXElement = '';
  const propsToPass = customProps[renderAs] || {};
  if (valueIsNull(dataColumn)) {
    renderValue = NULL_SYMBOL;
  } else {
    switch (renderAs) {
      case 'cell': {
        const resultCellValue = getCellValue(dataColumn);
        if (valueIsNumber(field, resultCellValue)) {
          // TS doesn't support typeguards for multiple parameters, so unfortunately have to assert AtomicField here. https://github.com/microsoft/TypeScript/issues/26916
          renderValue = renderNumericField(field, resultCellValue);
        } else if (valueIsString(field, resultCellValue)) {
          renderValue = resultCellValue;
        } else if (isAtomic(field) && (isDate(field) || isTimestamp(field))) {
          renderValue = renderTime(props);
        } else {
          // try to force to string
          renderValue = String(resultCellValue);
        }
        break;
      }
      case 'link': {
        // renderAs will only return link for AtomicFields. TODO: add additional typeguard here?
        renderValue = renderLink(field, dataColumn);
        break;
      }
      case 'list': {
        // TODO: typeguard here?
        renderValue = renderList(props);
        break;
      }
      case 'image': {
        renderValue = renderImage(props);
        break;
      }
      case 'chart': {
        renderValue = (
          <Chart
            field={field as NestFieldInfo}
            data={getCellValue(dataColumn)}
            metadata={resultMetadata}
            {...propsToPass}
          />
        );
        break;
      }
      case 'dashboard': {
        if (dataColumn.kind === 'array_cell')
          renderValue = (
            <Dashboard
              field={field as NestFieldInfo}
              data={dataColumn}
              {...propsToPass}
            />
          );
        else
          throw new Error(
            `Malloy render: wrong data type passed to the dashboard renderer for field ${field.name}`
          );
        break;
      }
      // case 'scatter_chart':
      // case 'shape_map':
      // case 'segment_map': {
      //   if (dataColumn.kind === 'table_cell')
      //     renderValue = <LegacyChart type={renderAs} data={dataColumn} />;
      //   else
      //     throw new Error(
      //       `Malloy render: wrong data type passed to the ${renderAs} renderer for field ${dataColumn.field.name}`
      //     );
      //   break;
      // }
      case 'table': {
        if (isNest(field))
          renderValue = (
            <MalloyTable
              field={field}
              data={
                // TODO need to support array of record, table, and record
                dataColumn as
                  | Malloy.CellWithArrayCell
                  | Malloy.CellWithRecordCell
              }
              {...propsToPass}
            />
          );
        else
          throw new Error(
            `Malloy render: wrong data type passed to the table renderer for field ${field.name}`
          );
        break;
      }
      default: {
        try {
          renderValue = String(getCellValue(dataColumn));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('Couldnt get value for ', field, dataColumn);
        }
      }
    }
  }
  return {renderAs, renderValue};
}
