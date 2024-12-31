/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  AtomicField,
  DataArrayOrRecord,
  DataColumn,
  Explore,
  ExploreField,
  Field,
  Tag,
} from '@malloydata/malloy';
import {RenderResultMetadata} from './types';
import {valueIsNumber, valueIsString} from './util';
import {JSXElement} from 'solid-js';
import {renderNumericField} from './render-numeric-field';
import {renderLink} from './render-link';
import {Chart} from './chart/chart';
import MalloyTable from './table/table';
import {renderList} from './render-list';
import {renderImage} from './render-image';
import {Dashboard} from './dashboard/dashboard';
import {LegacyChart} from './legacy-charts/legacy_chart';
import {renderTime} from './render-time';

export type RendererProps = {
  field: Field;
  dataColumn: DataColumn;
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

export function shouldRenderAs(f: Field | Explore, tagOverride?: Tag) {
  const tag = tagOverride ?? f.tagParse().tag;
  const tagNamesInOrder = Object.keys(tag.properties ?? {}).reverse();
  for (const tagName of tagNamesInOrder) {
    if (RENDER_TAG_LIST.includes(tagName)) {
      if (['list', 'list_detail'].includes(tagName)) return 'list';
      if (['bar_chart', 'line_chart'].includes(tagName)) return 'chart';
      return tagName;
    }
  }

  if (!f.isExplore() && f.isAtomicField()) return 'cell';
  return 'table';
}

export const NULL_SYMBOL = '∅';

export function applyRenderer(props: RendererProps) {
  const {field, dataColumn, resultMetadata, customProps = {}} = props;
  const renderAs = resultMetadata.field(field).renderAs;
  let renderValue: JSXElement = '';
  const propsToPass = customProps[renderAs] || {};
  if (dataColumn.isNull()) {
    renderValue = NULL_SYMBOL;
  } else {
    switch (renderAs) {
      case 'cell': {
        const resultCellValue = dataColumn.value;
        if (valueIsNumber(field, resultCellValue)) {
          // TS doesn't support typeguards for multiple parameters, so unfortunately have to assert AtomicField here. https://github.com/microsoft/TypeScript/issues/26916
          renderValue = renderNumericField(
            field as AtomicField,
            resultCellValue
          );
        } else if (valueIsString(field, resultCellValue)) {
          renderValue = resultCellValue;
        } else if (
          field.isAtomicField() &&
          (field.isDate() || field.isTimestamp())
        ) {
          renderValue = renderTime(props);
        } else {
          // try to force to string
          renderValue = String(resultCellValue);
        }
        break;
      }
      case 'link': {
        // renderAs will only return link for AtomicFields. TODO: add additional typeguard here?
        renderValue = renderLink(field as AtomicField, dataColumn);
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
            field={field as ExploreField}
            data={resultMetadata.getData(dataColumn)}
            metadata={resultMetadata}
            {...propsToPass}
          />
        );
        break;
      }
      case 'dashboard': {
        if (dataColumn.isArray())
          renderValue = <Dashboard data={dataColumn} {...propsToPass} />;
        else
          throw new Error(
            `Malloy render: wrong data type passed to the dashboard renderer for field ${dataColumn.field.name}`
          );
        break;
      }
      case 'scatter_chart':
      case 'shape_map':
      case 'segment_map': {
        if (dataColumn.isArray())
          renderValue = <LegacyChart type={renderAs} data={dataColumn} />;
        else
          throw new Error(
            `Malloy render: wrong data type passed to the ${renderAs} renderer for field ${dataColumn.field.name}`
          );
        break;
      }
      case 'table': {
        if (dataColumn.isArrayOrRecord())
          renderValue = (
            <MalloyTable
              data={dataColumn as DataArrayOrRecord}
              {...propsToPass}
            />
          );
        else
          throw new Error(
            `Malloy render: wrong data type passed to the table renderer for field ${dataColumn.field.name}`
          );
        break;
      }
      default: {
        try {
          renderValue = String(dataColumn.value);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('Couldnt get value for ', field, dataColumn);
        }
      }
    }
  }
  return {renderAs, renderValue};
}
