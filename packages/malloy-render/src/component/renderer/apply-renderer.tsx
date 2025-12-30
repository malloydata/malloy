/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {JSXElement} from 'solid-js';
import {renderNumberCell} from '@/component/render-numeric-field';
import {renderLink} from '@/component/render-link';
import MalloyTable from '@/component/table/table';
import {renderList} from '@/component/render-list';
import {renderImage} from '@/component/render-image';
import {Dashboard} from '@/component/dashboard/dashboard';
import {renderTime} from '@/component/render-time';
import {LegacyChart} from '@/component/legacy-charts/legacy_chart';
import {NULL_SYMBOL} from '@/util';
import type {RendererProps} from '@/component/types';
import {PluginRenderContainer} from '@/component/renderer/plugin-render-container';

export function applyRenderer(props: RendererProps) {
  const {dataColumn, customProps = {}} = props;
  const field = props.dataColumn.field;

  const renderAs = field.renderAs();

  // Check for plugins first
  const plugin = field.getPlugins().at(0);
  if (plugin) {
    return {
      renderAs,
      renderValue: (
        <PluginRenderContainer
          plugin={plugin}
          renderProps={{
            dataColumn,
            field,
            customProps,
          }}
        />
      ),
    };
  }

  // Fallback to existing renderer logic
  let renderValue: JSXElement = '';
  const propsToPass = customProps[renderAs] || {};
  if (dataColumn.isNull()) {
    renderValue = NULL_SYMBOL;
  } else {
    switch (renderAs) {
      case 'cell': {
        if (dataColumn.isNumber()) {
          renderValue = renderNumberCell(dataColumn);
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
