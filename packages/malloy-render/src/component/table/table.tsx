import {
  createSignal,
  createMemo,
  For,
  Component,
  mergeProps,
  Show,
  Switch,
  Match,
  JSXElement,
  JSX,
  onMount,
} from 'solid-js';
import {DataArrayOrRecord, DataRecord, Field} from '@malloydata/malloy';
import {getRangeSize, isFirstChild, isLastChild} from '../util';
import {getTableLayout} from './table-layout';
import {useResultContext} from '../result-context';
import {createTableStore, TableContext, useTableContext} from './table-context';
import './table.css';
import {applyRenderer, shouldRenderAs} from '../apply-renderer';
import {isFieldHidden} from '../../tags_utils';
import {createStore, produce} from 'solid-js/store';
import {createVirtualizer, Virtualizer} from '@tanstack/solid-virtual';

const IS_CHROMIUM = navigator.userAgent.toLowerCase().indexOf('chrome') >= 0;
// CSS Subgrid + Sticky Positioning only seems to work reliably in Chrome
const SUPPORTS_STICKY = IS_CHROMIUM;

const Cell = (props: {
  field: Field;
  value: JSXElement;
  hideStartGutter: boolean;
  hideEndGutter: boolean;
  isHeader?: boolean;
  tableGutterLeft?: boolean;
  tableGutterRight?: boolean;
}) => {
  const style = () => {
    const layout = useTableContext()!.layout;
    const width = layout.fieldLayout(props.field).width;
    const height = layout.fieldLayout(props.field).height;
    const style: JSX.CSSProperties = {};
    if (!props.isHeader) {
      if (width) {
        style.width = `${width}px`;
        style['min-width'] = `${width}px`;
        style['max-width'] = `${width}px;`;
        if (typeof height === 'number') {
          style.height = `${height}px;`;
        }
      }
    }
    return style;
  };

  return (
    <div
      class="cell-content"
      classList={{
        'header': props.isHeader,
        'hide-start-gutter': props.hideStartGutter,
        'hide-end-gutter': props.hideEndGutter,
        'table-gutter-left': !!props.tableGutterLeft,
        'table-gutter-right': !!props.tableGutterRight,
      }}
      style={style()}
      title={typeof props.value === 'string' ? props.value : ''}
    >
      {props.value}
    </div>
  );
};

const HeaderField = (props: {field: Field; isPinned?: boolean}) => {
  const {layout: tableLayout} = useTableContext()!;
  const metadata = useResultContext();
  const isFirst = isFirstChild(props.field);
  const isParentFirst = isFirstChild(props.field.parentExplore);
  const isParentNotAField = !props.field.parentExplore.isExploreField();
  const hideStartGutter = isFirst && (isParentFirst || isParentNotAField);

  const isLast = isLastChild(props.field);
  const isParentLast = isLastChild(props.field.parentExplore);
  const hideEndGutter = isLast && (isParentLast || isParentNotAField);

  const fieldLayout = tableLayout.fieldLayout(props.field);
  const columnRange = props.isPinned
    ? fieldLayout.absoluteColumnRange
    : fieldLayout.relativeColumnRange;

  const tableGutterLeft =
    (fieldLayout.depth > 0 && isFirstChild(props.field)) ||
    fieldLayout.metadata.renderAs === 'table';
  const tableGutterRight =
    (fieldLayout.depth > 0 && isLastChild(props.field)) ||
    (fieldLayout.depth === 0 && fieldLayout.metadata.renderAs === 'table');

  return (
    <div
      class="column-cell th"
      data-pinned-header={
        props.isPinned ? metadata.getFieldKey(props.field) : undefined
      }
      classList={{
        'numeric': props.field.isAtomicField() && props.field.isNumber(),
        'pinned-header': props.isPinned,
      }}
      style={{
        'grid-column': `${columnRange[0] + 1} / span ${getRangeSize(
          columnRange
        )}`,
        'height': !props.isPinned
          ? `var(--malloy-render--table-header-height-${fieldLayout.depth})`
          : undefined,
      }}
    >
      <Cell
        field={props.field}
        // Add zero-width space so header name will wrap on _
        value={props.field.name.replace(/_/g, '_\u200b')}
        hideStartGutter={hideStartGutter}
        hideEndGutter={hideEndGutter}
        tableGutterLeft={tableGutterLeft}
        tableGutterRight={tableGutterRight}
        isHeader
      />
    </div>
  );
};

const TableField = (props: {field: Field; row: DataRecord}) => {
  let renderValue: JSXElement = '';
  let renderAs = '';
  ({renderValue, renderAs} = applyRenderer({
    field: props.field,
    dataColumn: props.row.cell(props.field),
    resultMetadata: useResultContext(),
    tag: props.field.tagParse().tag,
    customProps: {
      table: {
        rowLimit: 100, // Limit nested tables to 100 records
      },
    },
  }));
  const tableLayout = useTableContext()!.layout;
  const fieldLayout = tableLayout.fieldLayout(props.field);
  const columnRange = fieldLayout.relativeColumnRange;
  const style: JSX.CSSProperties = {
    'grid-column': `${columnRange[0] + 1} / span ${getRangeSize(columnRange)}`,
    'height': 'fit-content',
  };

  if (renderAs === 'table') {
    style.display = 'grid';
    style.grid = 'auto / subgrid';
  }
  // TODO: review what should be sticky
  else if (SUPPORTS_STICKY && props.field.isAtomicField()) {
    style.position = 'sticky';
    style.top = `var(--malloy-render--table-header-cumulative-height-${fieldLayout.depth})`;
  }
  // const fieldKey = metadata.getFieldKey()

  const tableGutterLeft = fieldLayout.depth > 0 && isFirstChild(props.field);
  const tableGutterRight = fieldLayout.depth > 0 && isLastChild(props.field);

  return (
    <div
      class="column-cell td"
      classList={{
        numeric: props.field.isAtomicField() && props.field.isNumber(),
      }}
      style={style}
    >
      <Switch>
        {/* When table, skip cell wrapper */}
        <Match when={renderAs === 'table'}>{renderValue}</Match>
        <Match when>
          <Cell
            field={props.field}
            value={renderValue}
            hideStartGutter={isFirstChild(props.field)}
            hideEndGutter={isLastChild(props.field)}
            tableGutterLeft={tableGutterLeft}
            tableGutterRight={tableGutterRight}
          />
        </Match>
      </Switch>
    </div>
  );
};

const MalloyTableRoot = (_props: {
  data: DataArrayOrRecord;
  rowLimit?: number;
  scrollEl?: HTMLElement;
}) => {
  const props = mergeProps({rowLimit: Infinity}, _props);
  const tableCtx = useTableContext()!;
  const resultMetadata = useResultContext();

  const pinnedFields = createMemo(() => {
    const fields = Object.entries(tableCtx.layout.fieldHeaderRangeMap)
      .sort((a, b) => {
        if (a[1].depth < b[1].depth) return -1;
        else if (a[1].depth > b[1].depth) return 1;
        else if (a[1].abs[0] < b[1].abs[0]) return -1;
        else if (a[1].abs[0] > b[1].abs[0]) return 1;
        else return 0;
      })
      .filter(([key, value]) => {
        const isNotRoot = value.depth >= 0;
        const isPartOfTable =
          isNotRoot &&
          shouldRenderAs(resultMetadata.fields[key].field.parentExplore!) ===
            'table';
        return isPartOfTable;
      })
      .map(([key, value]) => ({
        fieldKey: key,
        field: resultMetadata.fields[key].field,
        ...value,
      }));
    return fields;
  });

  const fieldsToSize = createMemo(() => {
    const fields = Object.entries(tableCtx.layout.fieldHeaderRangeMap).filter(
      ([key]) => !resultMetadata.fields[key].field.isExplore()
    );
    return fields;
  });

  const getContainerStyle: () => JSX.CSSProperties = () => {
    const columnRange = tableCtx.layout.fieldLayout(
      props.data.field
    ).relativeColumnRange;

    const style: JSX.CSSProperties = {
      '--table-row-span': getRangeSize(columnRange),
    };

    if (tableCtx.root) {
      let cumulativeDepth = 0;
      Object.entries(tableCtx.headerSizeStore[0])
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([depth, size]) => {
          style[`--malloy-render--table-header-height-${depth}`] = `${size}px`;
          cumulativeDepth += size;
          style[
            `--malloy-render--table-header-cumulative-height-${depth}`
          ] = `${cumulativeDepth}px`;
        });

      style['--total-header-size'] = tableCtx.layout.totalHeaderSize;
      const templateColumns = fieldsToSize()
        .map(([key]) => {
          const maybeSize = tableCtx.store.columnWidths[key];
          return `minmax(${
            maybeSize ? maybeSize + 'px' : 'auto'
          }, max-content)`;
        })
        .join(' ');
      style['grid-template-columns'] = templateColumns;
    }
    return style;
  };

  // TODO: Get this from resultMetadata cache?
  const [rowsAreLimited, setRowsAreLimited] = createSignal(false);
  const data = createMemo(() => {
    const data: DataRecord[] = [];
    let i = 0;
    for (const row of props.data) {
      if (i >= props.rowLimit) {
        setRowsAreLimited(true);
        break;
      }
      data.push(row);
      i++;
    }
    return data;
  });

  const visibleFields = () =>
    props.data.field.allFields.filter(f => !isFieldHidden(f));

  const pinnedFieldsByDepth = () => {
    const fields = pinnedFields();
    return fields.reduce<(typeof fields)[]>((acc, curr) => {
      const list = acc[curr.depth] || (acc[curr.depth] = []);
      list.push(curr);
      return acc;
    }, []);
  };

  /*
    Detect pinned by checking if the body has scrolled content offscreen,
    but the pinned content is still fully visible.
  */
  let bodyDetector: HTMLDivElement | undefined;
  let pinnedDetector: HTMLDivElement | undefined;
  const [bodyOffscreen, setBodyOffscreen] = createSignal(false);
  const [pinnedOffscreen, setPinnedOffscreen] = createSignal(false);
  const pinned = () => bodyOffscreen() && !pinnedOffscreen();
  onMount(() => {
    if (bodyDetector && pinnedDetector) {
      const observer = new IntersectionObserver(
        ([e]) => {
          setBodyOffscreen(e.intersectionRatio < 1);
        },
        {threshold: [1]}
      );
      observer.observe(bodyDetector);

      const observer2 = new IntersectionObserver(
        ([e]) => {
          setPinnedOffscreen(e.intersectionRatio < 1);
        },
        {threshold: [1]}
      );
      observer2.observe(pinnedDetector);
    }
  });

  const headerMeasureEls: HTMLDivElement[] = [];
  onMount(() => {
    if (tableCtx.root) {
      const [headerSizes, setHeaderSizes] = tableCtx.headerSizeStore;
      const resizeObserver = new ResizeObserver(entries => {
        const changes = entries.reduce((acc, e) => {
          const depth = e.target.getAttribute('data-depth');
          const newHeight = e.contentRect.height;
          if (typeof depth === 'string' && headerSizes[depth] !== newHeight) {
            acc[depth] = newHeight;
          }
          return acc;
        }, {});
        if (Object.entries(changes).length > 0)
          setHeaderSizes(store => {
            return {
              ...store,
              ...changes,
            };
          });
      });

      headerMeasureEls.forEach(el => {
        resizeObserver.observe(el);
      });
    }
  });

  let scrollEl!: HTMLElement;
  if (props.scrollEl) scrollEl = props.scrollEl;
  let virtualizer: Virtualizer<HTMLElement, Element> | undefined;

  if (tableCtx.root) {
    virtualizer = createVirtualizer({
      count: data().length,
      getScrollElement: () => scrollEl,
      estimateSize: () => 28,
    });
  }

  const items = virtualizer?.getVirtualItems();

  let pinnedHeaderRow!: HTMLDivElement;

  // Track scrolling state with 2s grace period
  // Used to only clear column width states on resize events that aren't due to data virtualization on scroll
  let isScrolling = false;
  const handleScroll = () => {
    isScrolling = true;
    setTimeout(() => {
      isScrolling = false;
    }, 2000);
  };

  // We want an initial measurement even if not scrolling
  let measureInitial = true;
  // Observe column width sizes
  onMount(() => {
    if (pinnedHeaderRow) {
      const resizeObserver = new ResizeObserver(() => {
        // select all nodes with data-pinned-header attribute
        if (isScrolling || measureInitial) {
          const pinnedHeaders = pinnedHeaderRow.querySelectorAll(
            '[data-pinned-header]'
          );
          const updates: [string, number][] = [];
          pinnedHeaders.forEach(node => {
            const key = node.getAttribute('data-pinned-header')!;
            const value = node.clientWidth;
            const currWidth = tableCtx.store.columnWidths[key];
            if (typeof currWidth === 'undefined' || value > currWidth)
              updates.push([key, value]);
          });
          if (updates.length > 0) {
            tableCtx.setStore(
              'columnWidths',
              produce((widths: Record<string, number>) => {
                updates.forEach(([key, value]) => (widths[key] = value));
              })
            );
          }
          // Update measureInitial on next tick so that table sizes don't immediately get cleared by other ResizeObserver
          setTimeout(() => (measureInitial = false), 0);
        }
      });
      resizeObserver.observe(pinnedHeaderRow);
    }
  });

  // Observe table width resize
  // Clear width cache if table changes size due to something besides scroll position (fetching new data)
  // Meant to handle when the table resizes due to less available real estate, like a viewport change
  // TODO find a better way to handle this scenario
  onMount(() => {
    if (tableCtx.root) {
      let priorWidth: number | null = null;
      const resizeObserver = new ResizeObserver(entries => {
        if (!isScrolling && !measureInitial) {
          const [entry] = entries;
          if (priorWidth !== entry.contentRect.width) {
            priorWidth = entry.contentRect.width;
            tableCtx.setStore(s => ({
              ...s,
              columnWidths: {},
            }));
          }
        }
      });
      resizeObserver.observe(scrollEl);
    }
  });

  const getPinnedHeaderRowStyle = () => ({
    'margin-bottom': `calc(-1 * var(--malloy-render--table-header-cumulative-height-${
      tableCtx.layout.maxDepth - 1
    }))`,
  });

  return (
    <div
      class="malloy-table"
      ref={el => {
        if (!props.scrollEl) scrollEl = el;
      }}
      classList={{
        'root': tableCtx.root,
        'pinned': pinned(),
      }}
      part={tableCtx.root ? 'table-container' : ''}
      style={getContainerStyle()}
      onScroll={handleScroll}
    >
      {/* pinned header */}
      <Show when={tableCtx.root}>
        <div
          ref={bodyDetector}
          style="position: sticky; left: 0px; height: 0px; visibility: hidden;"
        ></div>
        <div
          ref={pinnedDetector}
          style="position: sticky; top: 0px; left: 0px; height: 0px; visibility: hidden;"
        ></div>
        <div
          class="pinned-header-row"
          ref={pinnedHeaderRow}
          style={getPinnedHeaderRowStyle()}
        >
          <For each={pinnedFieldsByDepth()}>
            {(pinnedFields, idx) => (
              <div
                ref={el => (headerMeasureEls[idx()] = el)}
                data-depth={idx()}
                class="pinned-header-subrow"
              >
                <For each={pinnedFields}>
                  {pinnedField => (
                    <HeaderField field={pinnedField.field as Field} isPinned />
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </Show>
      {/* virtualized table */}
      <Show when={tableCtx.root}>
        <div
          class="table-row"
          style={
            tableCtx.root
              ? {
                  height: virtualizer!.getTotalSize() + 'px',
                  width: '100%',
                  position: 'relative',
                }
              : {}
          }
        >
          {/* second wrapper */}
          <div
            class="table-row"
            style={{
              'height': 'fit-content',
              'width': '100%',
              'padding-top': `${items![0]?.start ?? 0}px`,
            }}
          >
            <For each={items}>
              {virtualRow => (
                <div
                  class="table-row"
                  data-index={virtualRow.index}
                  ref={el =>
                    queueMicrotask(() => virtualizer!.measureElement(el))
                  }
                  style=""
                >
                  <Show when={virtualRow.index >= 0}>
                    <For each={visibleFields()}>
                      {field => (
                        <TableField
                          field={field}
                          row={data()[virtualRow.index]}
                        />
                      )}
                    </For>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
      {/* non-virtualized table */}
      <Show when={!tableCtx.root}>
        {/* header */}
        <div class="table-row">
          <For each={visibleFields()}>
            {field => <HeaderField field={field} />}
          </For>
        </div>
        {/* rows */}
        <For each={data()}>
          {row => (
            <div class="table-row">
              <For each={visibleFields()}>
                {field => <TableField field={field} row={row} />}
              </For>
            </div>
          )}
        </For>
        <Show when={rowsAreLimited()}>
          <div class="table-row limit-row table-gutter-left table-gutter-right">
            Limiting nested table to {props.rowLimit} records
          </div>
        </Show>
      </Show>
    </div>
  );
};

const MalloyTable: Component<{
  data: DataArrayOrRecord;
  rowLimit?: number;
  scrollEl?: HTMLElement;
}> = props => {
  const metadata = useResultContext();
  const hasTableCtx = !!useTableContext();
  const tableCtx = createMemo(() => {
    if (hasTableCtx) {
      const parentCtx = useTableContext()!;

      return {
        ...parentCtx,
        root: false,
      };
    }

    const [store, setStore] = createTableStore();
    return {
      root: true,
      layout: getTableLayout(metadata, props.data.field),
      store,
      setStore,
      headerSizeStore: createStore({}),
    };
  });

  return (
    <TableContext.Provider value={tableCtx()}>
      <MalloyTableRoot {...props} />
    </TableContext.Provider>
  );
};

export default MalloyTable;
