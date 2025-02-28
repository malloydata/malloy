/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createMemo, For, Show} from 'solid-js';
import {applyRenderer} from '../apply-renderer';
import {useResultContext} from '../result-context';
import {RenderResultMetadata} from '../types';
import {createVirtualizer, Virtualizer} from '@tanstack/solid-virtual';
import {useConfig} from '../render';
import dashboardCss from './dashboard.css?raw';
import * as Malloy from '@malloydata/malloy-interfaces';
import {
  getCell,
  getCellValue,
  getNestFields,
  isAtomic,
  NestFieldInfo,
  tagFor,
  wasCalculation,
  wasDimension,
} from '../util';
import {getFieldPathArrayFromRoot} from '../plot/util';

function DashboardItem(props: {
  parent: NestFieldInfo;
  field: Malloy.DimensionInfo;
  row: Malloy.Row;
  resultMetadata: RenderResultMetadata;
  maxTableHeight: number | null;
  isMeasure?: boolean;
}) {
  const config = useConfig();
  const metadata = useResultContext();
  const shouldVirtualizeTable = () => {
    // If dashboard is disabling virtualization, disable table virtualization as well
    // This is done mainly to support Copy to HTML; not sure if this is correct approach for other scenarios
    if (config.dashboardConfig().disableVirtualization) return false;
    // If a max height is provided for tables, virtualize them
    else if (props.maxTableHeight) return true;
    // If no max height is set, then don't virtualize
    else return false;
  };
  const cell = getCell(props.parent, props.row, props.field.name);
  const tag = tagFor(props.field);
  const rendering = applyRenderer({
    field: props.field,
    dataColumn: cell,
    tag,
    resultMetadata: props.resultMetadata,
    customProps: {
      table: {
        disableVirtualization: !shouldVirtualizeTable(),
      },
    },
  });

  const handleClick = (evt: MouseEvent) => {
    if (config.onClick)
      config.onClick({
        field: props.field,
        displayValue:
          typeof rendering.renderValue !== 'function'
            ? rendering.renderValue
            : null,
        value: getCellValue(cell),
        fieldPath: getFieldPathArrayFromRoot(props.field, metadata),
        isHeader: false,
        event: evt,
        type: 'dashboard-item',
      });
  };

  const itemStyle = {};
  if (rendering.renderAs === 'table' && props.maxTableHeight)
    itemStyle['max-height'] = `${props.maxTableHeight}px`;

  const customLabel = tag.text('label');
  const title = customLabel ?? props.field.name;

  return (
    <div
      class="dashboard-item"
      onClick={config.onClick ? handleClick : undefined}
    >
      <div class="dashboard-item-title">{title}</div>
      <div
        class="dashboard-item-value"
        classList={{
          'dashboard-item-value-measure': props.isMeasure,
        }}
        style={itemStyle}
      >
        {rendering.renderValue}
      </div>
    </div>
  );
}

export function Dashboard(props: {
  data: Malloy.CellWithArrayCell | Malloy.CellWithRecordCell;
  scrollEl?: HTMLElement;
  field: NestFieldInfo;
}) {
  const field = props.field;
  const tag = tagFor(field);
  const dashboardTag = tag.tag('dashboard');
  let maxTableHeight: number | null = 361;
  const maxTableHeightTag = dashboardTag?.tag('table', 'max_height');
  if (maxTableHeightTag?.text() === 'none') maxTableHeight = null;
  else if (maxTableHeightTag?.numeric())
    maxTableHeight = maxTableHeightTag!.numeric()!;

  const nestFields = getNestFields(field);
  const dimensions = () =>
    nestFields.filter(f => {
      const isHidden = tagFor(f).has('hidden');
      return !isHidden && isAtomic(f) && wasDimension(f);
    });

  const nonDimensions = () => {
    const measureFields: Malloy.DimensionInfo[] = [];
    const otherFields: Malloy.DimensionInfo[] = [];

    for (const f of nestFields) {
      if (tagFor(f).has('hidden')) continue;
      if (isAtomic(f) && wasCalculation(f)) {
        measureFields.push(f);
      } else if (!isAtomic(f) || !wasDimension(f)) otherFields.push(f);
    }
    return [...measureFields, ...otherFields];
  };

  const nonDimensionsGrouped = () => {
    const group: Malloy.DimensionInfo[][] = [[]];
    for (const f of nonDimensions()) {
      const tag = tagFor(f);
      if (tag.has('break')) {
        group.push([]);
      }
      const lastGroup = group.at(-1)!;
      lastGroup.push(f);
    }
    return group;
  };

  const data = createMemo(() => {
    const data: Malloy.Row[] = [];
    const rows =
      props.data.kind === 'record_cell' ? [props.data] : props.data.array_value;
    for (const row of rows) {
      if (row.kind !== 'record_cell') {
        throw new Error('Expected record cell');
      }
      data.push(row.record_value);
    }
    return data;
  });

  let scrollEl!: HTMLElement;
  if (props.scrollEl) scrollEl = props.scrollEl;
  const shouldVirtualize = () =>
    !useConfig().dashboardConfig().disableVirtualization;
  let virtualizer: Virtualizer<HTMLElement, Element> | undefined;
  if (shouldVirtualize()) {
    virtualizer = createVirtualizer({
      count: data().length,
      getScrollElement: () => scrollEl,
      estimateSize: () => 192,
    });
  }
  const items = virtualizer?.getVirtualItems();

  const resultMetadata = useResultContext();

  const config = useConfig();
  config.addCSSToShadowRoot(dashboardCss);

  return (
    <div
      class="malloy-dashboard"
      ref={el => {
        if (!props.scrollEl) scrollEl = el;
      }}
    >
      <Show when={shouldVirtualize()}>
        <div
          style={{
            height: virtualizer!.getTotalSize() + 'px',
            width: '100%',
            position: 'relative',
          }}
        >
          <div
            style={{
              'height': 'fit-content',
              'width': '100%',
              'padding-top': `${items![0]?.start ?? 0}px`,
            }}
          >
            <For each={items}>
              {virtualRow => (
                <div
                  class="dashboard-row"
                  data-index={virtualRow.index}
                  ref={el =>
                    queueMicrotask(() => virtualizer!.measureElement(el))
                  }
                >
                  <div class="dashboard-row-header">
                    <div class="dashboard-row-header-dimension-list">
                      <For each={dimensions()}>
                        {d => (
                          <div class="dashboard-dimension-wrapper">
                            <div class="dashboard-dimension-name">{d.name}</div>
                            <div class="dashboard-dimension-value">
                              {
                                applyRenderer({
                                  field: d,
                                  dataColumn: getCell(
                                    props.field,
                                    data()[virtualRow.index],
                                    d.name
                                  ),
                                  tag: tagFor(d),
                                  resultMetadata,
                                }).renderValue
                              }
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                    <div class="dashboard-row-header-separator" />
                  </div>
                  <For each={nonDimensionsGrouped()}>
                    {group => (
                      <div class="dashboard-row-body">
                        <For each={group}>
                          {field => (
                            <DashboardItem
                              parent={props.field}
                              field={field}
                              row={data()[virtualRow.index]}
                              resultMetadata={resultMetadata}
                              isMeasure={
                                isAtomic(field) && wasCalculation(field)
                              }
                              maxTableHeight={maxTableHeight}
                            />
                          )}
                        </For>
                      </div>
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
      <Show when={!shouldVirtualize()}>
        <For each={data()}>
          {row => (
            <div class="dashboard-row">
              <div class="dashboard-row-header">
                <div class="dashboard-row-header-dimension-list">
                  <For each={dimensions()}>
                    {d => (
                      <div class="dashboard-dimension-wrapper">
                        <div class="dashboard-dimension-name">{d.name}</div>
                        <div class="dashboard-dimension-value">
                          {
                            applyRenderer({
                              field: d,
                              dataColumn: getCell(props.field, row, d.name),
                              tag: tagFor(d),
                              resultMetadata,
                            }).renderValue
                          }
                        </div>
                      </div>
                    )}
                  </For>
                </div>
                <div class="dashboard-row-header-separator" />
              </div>
              <For each={nonDimensionsGrouped()}>
                {group => (
                  <div class="dashboard-row-body">
                    <For each={group}>
                      {field => (
                        <DashboardItem
                          parent={props.field}
                          field={field}
                          row={row}
                          resultMetadata={resultMetadata}
                          isMeasure={isAtomic(field) && wasCalculation(field)}
                          maxTableHeight={maxTableHeight}
                        />
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
