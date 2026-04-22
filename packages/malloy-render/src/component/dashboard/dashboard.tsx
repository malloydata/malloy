/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {For, Show} from 'solid-js';
import {applyRenderer} from '@/component/renderer/apply-renderer';
import type {Virtualizer} from '@tanstack/solid-virtual';
import {createVirtualizer} from '@tanstack/solid-virtual';
import type {Field, RecordCell, RecordOrRepeatedRecordCell} from '@/data_tree';
import {MalloyViz} from '@/api/malloy-viz';
import styles from './dashboard.css?raw';
import {useConfig} from '../render';
import type {DashboardNestConfig} from '@/component/tag-configs';

// Per-item minimum widths. Used for:
//   - bucket assignment (minRowWidth -> row-collapse-{sm,md,lg})
//   - flex-mode min-width in dashboard.css (keep those values in sync)
const MIN_WIDTH_MEASURE = 120;
const MIN_WIDTH_ITEM = 300;

// Default gap. Must match the CSS fallback in dashboard.css
// (var(--malloy-render--dashboard-gap, 16px)).
const DEFAULT_GAP_PX = 16;

// Responsive collapse buckets. A row is assigned the first bucket whose
// threshold is ≥ its minRowWidth; that same bucket's threshold is the
// @container max-width at which it stacks — see dashboard.css.
const COLLAPSE_BUCKETS = [
  {className: 'row-collapse-sm', threshold: 400},
  {className: 'row-collapse-md', threshold: 600},
  {className: 'row-collapse-lg', threshold: 900},
] as const;

const bucketFor = (minRowWidth: number): string => {
  for (const {className, threshold} of COLLAPSE_BUCKETS) {
    if (minRowWidth <= threshold) return className;
  }
  return COLLAPSE_BUCKETS[COLLAPSE_BUCKETS.length - 1].className;
};

function DashboardItem(props: {
  field: Field;
  row: RecordCell;
  maxTableHeight: number | null;
  isMeasure?: boolean;
}) {
  const config = useConfig();
  const shouldVirtualizeTable = () => {
    if (config.dashboardConfig().disableVirtualization) return false;
    else if (props.maxTableHeight) return true;
    else return false;
  };
  const cell = props.row.column(props.field.name);
  const rendering = applyRenderer({
    dataColumn: cell,
    customProps: {
      table: {
        disableVirtualization: !shouldVirtualizeTable(),
        shouldFillWidth: true,
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
        value: cell.value,
        fieldPath: props.field.path,
        isHeader: false,
        event: evt,
        type: 'dashboard-item',
      });
  };

  const itemStyle = {};
  if (rendering.renderAs === 'table' && props.maxTableHeight)
    itemStyle['max-height'] = `${props.maxTableHeight}px`;

  const title = props.field.getLabel();
  const subtitle = props.field.getSubtitle();

  return (
    <div
      class="dashboard-item"
      classList={{
        'dashboard-item-measure': !!props.isMeasure,
        'dashboard-item-borderless': props.field.isBorderless(),
      }}
      onClick={config.onClick ? handleClick : undefined}
    >
      <div class="dashboard-item-header">
        <div class="dashboard-item-title">{title}</div>
        <Show when={subtitle}>
          <div class="dashboard-item-subtitle">{subtitle}</div>
        </Show>
      </div>
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
  data: RecordOrRepeatedRecordCell;
  scrollEl?: HTMLElement;
}) {
  MalloyViz.addStylesheet(styles);
  const field = props.data.field;
  const dashConfig = field.getTagConfig<DashboardNestConfig>();

  // resolveDashboardTags always returns a config; 361 fallback is a safety net
  // for unexpected undefined. Preserve null (means "no limit, no virtualization").
  const maxTableHeight =
    dashConfig !== undefined ? dashConfig.maxTableHeight : 361;
  const columns = dashConfig?.columns;
  const gap = dashConfig?.gap;
  const gapPx = gap ?? DEFAULT_GAP_PX;

  const dashboardStyle = () => {
    const style: Record<string, string> = {};
    if (gap !== undefined) style['--malloy-render--dashboard-gap'] = `${gap}px`;
    return style;
  };

  const useGrid = (() => {
    if (columns !== undefined || gap !== undefined) return true;
    return field.fields.some(
      f =>
        !f.isHidden() &&
        !(f.isBasic() && f.wasDimension()) &&
        (f.getSpan() !== undefined || f.hasBreak())
    );
  })();

  const getColumnsStyle = () => {
    if (columns === undefined) return {};
    return {'grid-template-columns': `repeat(${columns}, 1fr)`};
  };

  const itemMinWidth = (f: Field): number =>
    f.isBasic() && f.wasCalculation() ? MIN_WIDTH_MEASURE : MIN_WIDTH_ITEM;

  // In columns mode every cell is the same width (repeat(N, 1fr)), so each
  // column must be wide enough for the group's worst case.
  const getColumnsMinWidth = (group: Field[]): number => {
    if (columns === undefined || group.length === 0) return 0;
    const maxItemMin = Math.max(...group.map(itemMinWidth));
    return columns * maxItemMin + (columns - 1) * gapPx;
  };

  // Compute the effective span for a field
  const computeSpan = (f: Field): number => {
    const explicit = f.getSpan();
    if (explicit !== undefined) return explicit;
    if (f.isBasic() && f.wasCalculation()) return 3;
    if (f.isNest()) {
      const visibleChildren = f.fields.filter(c => !c.isHidden());
      const weight = visibleChildren.reduce(
        (sum, c) => sum + (c.isNest() ? 3 : 1),
        0
      );
      if (weight <= 3) return 4;
      if (weight <= 5) return 6;
      if (weight <= 8) return 8;
      return 12;
    }
    return 6;
  };

  // Compute per-row grid config from the items' spans
  const getRowConfig = (group: Field[]) => {
    const spans = group.map(f => computeSpan(f));
    const totalSpan = spans.reduce((a, b) => a + b, 0);

    // When the row fills 12 cols, use `fr` so items split the full row in
    // proportion to their spans. When it doesn't, use `minmax(0, N%)` so
    // items take exactly their share of 12 (span 3 of 12 = 25% width) —
    // otherwise two span=3 items in a half-full row would each stretch to
    // 50% and lose the sizing intent.
    const frTemplate = totalSpan >= 12
      ? spans.map(s => `${s}fr`).join(' ')
      : spans.map(s => `minmax(0, ${((s / 12) * 100).toFixed(1)}%)`).join(' ');

    const minWidths = group.map(itemMinWidth);
    const minRowWidth = minWidths.reduce((a, b) => a + b, 0)
      + (group.length - 1) * gapPx;

    return {frTemplate, collapseClass: bucketFor(minRowWidth)};
  };

  const getRowStyle = (group: Field[]) => {
    if (!useGrid) return {};
    if (columns !== undefined) return getColumnsStyle();
    return {'grid-template-columns': getRowConfig(group).frTemplate};
  };

  const getRowClassList = (group: Field[]) => {
    const classes: Record<string, boolean> = {
      'dashboard-grid': useGrid,
      'dashboard-columns': columns !== undefined,
    };
    if (useGrid && columns === undefined) {
      classes[getRowConfig(group).collapseClass] = true;
    }
    if (columns !== undefined) {
      classes[bucketFor(getColumnsMinWidth(group))] = true;
    }
    return classes;
  };

  const dimensions = () =>
    field.fields.filter(f => {
      return !f.isHidden() && f.isBasic() && f.wasDimension();
    });

  const nonDimensions = () => {
    const measureFields: Field[] = [];
    const otherFields: Field[] = [];

    for (const f of field.fields) {
      if (f.isHidden()) continue;
      if (f.isBasic() && f.wasCalculation()) {
        measureFields.push(f);
      } else if (!f.isBasic() || !f.wasDimension()) otherFields.push(f);
    }
    return [...measureFields, ...otherFields];
  };

  const nonDimensionsGrouped = () => {
    const group: Field[][] = [[]];
    for (const f of nonDimensions()) {
      if (f.hasBreak()) {
        group.push([]);
      }
      const lastGroup = group.at(-1)!;
      lastGroup.push(f);
    }
    return group;
  };

  let scrollEl!: HTMLElement;
  if (props.scrollEl) scrollEl = props.scrollEl;
  const shouldVirtualize = () =>
    !useConfig().dashboardConfig().disableVirtualization;
  let virtualizer: Virtualizer<HTMLElement, Element> | undefined;
  if (shouldVirtualize()) {
    virtualizer = createVirtualizer({
      count: props.data.rows.length,
      getScrollElement: () => scrollEl,
      estimateSize: () => 192,
    });
  }
  const items = virtualizer?.getVirtualItems();

  return (
    <div
      class="malloy-dashboard"
      style={dashboardStyle()}
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
                            <div class="dashboard-dimension-name">
                              {d.getLabel()}
                            </div>
                            <div class="dashboard-dimension-value">
                              {
                                applyRenderer({
                                  dataColumn: props.data.rows[
                                    virtualRow.index
                                  ].column(d.name),
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
                      <div
                        class="dashboard-row-body"
                        classList={getRowClassList(group)}
                        style={getRowStyle(group)}
                      >
                        <For each={group}>
                          {field => (
                            <DashboardItem
                              field={field}
                              row={props.data.rows[virtualRow.index]}
                              isMeasure={field.wasCalculation()}
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
        <For each={props.data.rows}>
          {row => (
            <div class="dashboard-row">
              <div class="dashboard-row-header">
                <div class="dashboard-row-header-dimension-list">
                  <For each={dimensions()}>
                    {d => (
                      <div class="dashboard-dimension-wrapper">
                        <div class="dashboard-dimension-name">
                          {d.getLabel()}
                        </div>
                        <div class="dashboard-dimension-value">
                          {
                            applyRenderer({
                              dataColumn: row.column(d.name),
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
                  <div
                    class="dashboard-row-body"
                    classList={getRowClassList(group)}
                    style={getRowStyle(group)}
                  >
                    <For each={group}>
                      {field => (
                        <DashboardItem
                          field={field}
                          row={row}
                          isMeasure={field.wasCalculation()}
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
