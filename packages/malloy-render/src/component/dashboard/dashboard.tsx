/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {For, Show} from 'solid-js';
import {applyRenderer} from '@/component/renderer/apply-renderer';
import type {Virtualizer} from '@tanstack/solid-virtual';
import {createVirtualizer} from '@tanstack/solid-virtual';
import type {Field, RecordCell, RecordOrRepeatedRecordCell} from '@/data_tree';
import {MalloyViz} from '@/api/malloy-viz';
import styles from './dashboard.css?raw';
import {useConfig} from '../render';
import type {
  DashboardChildConfig,
  DashboardNestConfig,
} from '@/component/tag-configs';

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
  colspan?: number;
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
      // Big values inside a dashboard render embedded: the dashboard item
      // supplies the card chrome, so big-value flattens itself rather than
      // the dashboard reaching into big-value's internal classes.
      big_value: {
        embedded: true,
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
  const childConfig =
    props.field.getDashboardChildConfig<DashboardChildConfig>();
  const subtitle = childConfig?.subtitle;

  // Position the card in columns mode: # colspan widens it past one column.
  const cardStyle =
    props.colspan !== undefined && props.colspan > 1
      ? {'grid-column': `span ${props.colspan}`}
      : undefined;

  return (
    <div
      class="dashboard-item"
      classList={{
        'dashboard-item-measure': !!props.isMeasure,
        'dashboard-item-borderless': !!childConfig?.borderless,
      }}
      style={cardStyle}
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

  const childConfigOf = (f: Field) =>
    f.getDashboardChildConfig<DashboardChildConfig>();

  const dashboardStyle = () => {
    const style: Record<string, string> = {};
    if (gap !== undefined) style['--malloy-render--dashboard-gap'] = `${gap}px`;
    return style;
  };

  // Two layout modes: flex (the default) flows tiles and wraps; columns
  // (columns=N) places them in N columns, widened per-tile by # colspan. gap
  // is spacing only, never a mode trigger, so the mode round-trips on a copied
  // dashboard (drop columns and it falls back to flex).
  const useColumns = columns !== undefined;

  const getColumnsStyle = () => {
    if (columns === undefined) return {};
    return {'grid-template-columns': `repeat(${columns}, 1fr)`};
  };

  const itemMinWidth = (f: Field): number =>
    f.isBasic() && f.wasCalculation() ? MIN_WIDTH_MEASURE : MIN_WIDTH_ITEM;

  // In columns mode every column is the same width (repeat(N, 1fr)), so each
  // must be wide enough for the group's worst case before the row stacks.
  const getColumnsMinWidth = (group: Field[]): number => {
    if (columns === undefined || group.length === 0) return 0;
    const maxItemMin = Math.max(...group.map(itemMinWidth));
    return columns * maxItemMin + (columns - 1) * gapPx;
  };

  // A tile spans one column by default; # colspan widens it. Clamp to the
  // column count, since CSS clamps a span past the track count anyway.
  const colspanOf = (f: Field): number => {
    if (columns === undefined) return 1;
    return Math.min(childConfigOf(f)?.colspan ?? 1, columns);
  };

  const getRowClassList = (group: Field[]) => {
    const classes: Record<string, boolean> = {
      'dashboard-columns': useColumns,
    };
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
      if (childConfigOf(f)?.break) {
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
                        style={getColumnsStyle()}
                      >
                        <For each={group}>
                          {field => (
                            <DashboardItem
                              field={field}
                              row={props.data.rows[virtualRow.index]}
                              isMeasure={field.wasCalculation()}
                              maxTableHeight={maxTableHeight}
                              colspan={colspanOf(field)}
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
                    style={getColumnsStyle()}
                  >
                    <For each={group}>
                      {field => (
                        <DashboardItem
                          field={field}
                          row={row}
                          isMeasure={field.wasCalculation()}
                          maxTableHeight={maxTableHeight}
                          colspan={colspanOf(field)}
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
