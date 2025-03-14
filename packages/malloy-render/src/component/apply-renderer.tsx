/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {JSXElement} from 'solid-js';
import {renderNumericField} from './render-numeric-field';
import {renderLink} from './render-link';
import {Chart} from './chart/chart';
import MalloyTable from './table/table';
import {renderList} from './render-list';
import {renderImage} from './render-image';
import {Dashboard} from './dashboard/dashboard';
import {renderTime} from './render-time';
import {LegacyChart} from './legacy-charts/legacy_chart';
import {NULL_SYMBOL} from '../util';
import type {RendererProps} from './types';

export function applyRenderer(props: RendererProps) {
  const {dataColumn, customProps = {}} = props;
  const field = props.dataColumn.field;
  const renderAs = field.renderAs;
  let renderValue: JSXElement = '';
  const propsToPass = customProps[renderAs] || {};
  if (dataColumn.isNull()) {
    renderValue = NULL_SYMBOL;
  } else {
    switch (renderAs) {
      case 'cell': {
        if (dataColumn.isNumber()) {
          // TS doesn't support typeguards for multiple parameters, so unfortunately have to assert AtomicField here. https://github.com/microsoft/TypeScript/issues/26916
          renderValue = renderNumericField(field, dataColumn.value);
        } else if (dataColumn.isString()) {
          renderValue = dataColumn.value;
        } else if (field.isTime()) {
          renderValue = renderTime(props);
        } else {
          // try to force to string
          renderValue = String(dataColumn.value);
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
        if (dataColumn.isRepeatedRecord()) {
          renderValue = <Chart data={dataColumn} {...propsToPass} />;
        }
        break;
      }
      case 'dashboard': {
        if (dataColumn.isRecordOrRepeatedRecord())
          renderValue = <Dashboard data={dataColumn} {...propsToPass} />;
        else
          throw new Error(
            `Malloy render: wrong data type passed to the dashboard renderer for field ${field.name}`
          );
        break;
      }
      case 'scatter_chart':
      case 'shape_map':
      case 'segment_map': {
        if (dataColumn.isRepeatedRecord())
          renderValue = <LegacyChart type={renderAs} data={dataColumn} />;
        else
          throw new Error(
            `Malloy render: wrong data type passed to the ${renderAs} renderer for field ${field.name}`
          );
        break;
      }
      case 'table': {
        if (dataColumn.isRecordOrRepeatedRecord())
          renderValue = <MalloyTable data={dataColumn} {...propsToPass} />;
        else
          throw new Error(
            `Malloy render: wrong data type passed to the table renderer for field ${field.name}`
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
