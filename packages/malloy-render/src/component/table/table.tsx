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
} from 'solid-js';
import {DataArray, DataRecord, Field} from '@malloydata/malloy';
import {getRangeSize, isFirstChild, isLastChild, shouldRenderAs} from '../util';
import {getTableLayout} from './table-layout';
import {useResultContext} from '../result-context';
import {TableContext, useTableContext} from './table-context';
import './table.css';
import {applyRenderer} from '../apply-renderer';
import {isFieldHidden} from '../../tags_utils';

const IS_CHROMIUM = navigator.userAgent.toLowerCase().indexOf('chrome') >= 0;
// CSS Subgrid + Sticky Positioning only seems to work reliably in Chrome
const SUPPORTS_STICKY = IS_CHROMIUM;

const Cell = (props: {
  field: Field;
  value: JSXElement;
  hideStartGutter: boolean;
  hideEndGutter: boolean;
  isHeader?: boolean;
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
      }}
      style={style()}
      title={typeof props.value === 'string' ? props.value : ''}
    >
      {props.value}
    </div>
  );
};

function renameColumn(name: string) {
  return name.replace(/_/g, ' ');
}

const HeaderField = (props: {field: Field; isPinned?: boolean}) => {
  const {layout: tableLayout, autoRenameColumns} = useTableContext()!;
  const isFirst = isFirstChild(props.field);
  const isParentFirst = isFirstChild(props.field.parentExplore);
  const isParentNotAField = !props.field.parentExplore.isExploreField();
  const hideStartGutter = isFirst && (isParentFirst || isParentNotAField);

  const isLast = isLastChild(props.field);
  const isParentLast = isLastChild(props.field.parentExplore);
  const hideEndGutter = isLast && (isParentLast || isParentNotAField);

  const columnRange = props.isPinned
    ? tableLayout.fieldLayout(props.field).absoluteColumnRange
    : tableLayout.fieldLayout(props.field).relativeColumnRange;

  return (
    <div
      class="column-cell th"
      classList={{
        'numeric': props.field.isAtomicField() && props.field.isNumber(),
        'pinned-header': props.isPinned,
      }}
      style={{
        'grid-column': `${columnRange[0] + 1} / span ${getRangeSize(
          columnRange
        )}`,
      }}
    >
      <Cell
        field={props.field}
        value={
          autoRenameColumns ? renameColumn(props.field.name) : props.field.name
        }
        hideStartGutter={hideStartGutter}
        hideEndGutter={hideEndGutter}
        isHeader
      />
    </div>
  );
};

const TableField = (props: {field: Field; row: DataRecord}) => {
  const tableCtx = useTableContext()!;
  let renderValue: JSXElement = '';
  let renderAs = '';
  ({renderValue, renderAs} = applyRenderer({
    field: props.field,
    dataColumn: props.row.cell(props.field),
    resultMetadata: useResultContext(),
    tag: props.field.tagParse().tag,
    customProps: {
      table: {
        pinnedHeader: tableCtx.pinnedHeader,
        rowLimit: tableCtx.pinnedHeader ? 1 : Infinity,
      },
    },
  }));

  // Hide table content in pinned header
  if (tableCtx.pinnedHeader && renderAs !== 'table') renderValue = '';

  const tableLayout = useTableContext()!.layout;
  const columnRange = tableLayout.fieldLayout(props.field).relativeColumnRange;
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
    style.top = `${(tableLayout.fieldLayout(props.field).depth + 1) * 28}px`;
  }

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
          />
        </Match>
      </Switch>
    </div>
  );
};

const MalloyTableRoot = (_props: {
  data: DataArray;
  rowLimit?: number;
  pinnedHeader?: boolean;
}) => {
  const props = mergeProps({rowLimit: Infinity, pinnedHeader: false}, _props);
  const tableCtx = useTableContext()!;
  const resultMetadata = useResultContext();

  const [scrolling, setScrolling] = createSignal(false);
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    setScrolling(target.scrollTop > 0);
  };

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
          shouldRenderAs(resultMetadata.fields[key].field.parentExplore!) ===
          'table';
        return isNotRoot && isPartOfTable;
      })
      .map(([key, value]) => ({
        fieldKey: key,
        field: resultMetadata.fields[key].field,
        ...value,
      }));
    return fields;
  });

  const maxDepth = createMemo(() =>
    Math.max(...pinnedFields().map(f => f.depth))
  );

  const getContainerStyle: () => JSX.CSSProperties = () => {
    if (tableCtx.root) {
      return {
        'grid-template-columns': `repeat(${tableCtx.layout.totalHeaderSize}, max-content)`,
      };
    }
    const columnRange = tableCtx.layout.fieldLayout(
      props.data.field
    ).relativeColumnRange;
    return {
      'grid-column': `1 / span ${getRangeSize(columnRange)}`,
    };
  };

  const getRowStyle: (idx: number) => JSX.CSSProperties = (idx: number) => {
    const columnRange = tableCtx.layout.fieldLayout(
      props.data.field
    ).relativeColumnRange;
    const rowStyle = {
      'grid-column': `1 / span ${getRangeSize(columnRange)}`,
    };

    // Offset first row to hide behind pinned headers
    if (idx === 0 && tableCtx.root)
      rowStyle[
        'margin-top'
      ] = `calc(-${maxDepth()} * var(--malloy-render--table-row-height))`;

    return rowStyle;
  };

  // TODO: Get this from resultMetadata cache?
  const data = createMemo(() => {
    const data: DataRecord[] = [];
    let i = 0;
    for (const row of props.data) {
      if (i >= props.rowLimit) break;
      data.push(row);
      i++;
    }
    return data;
  });

  const visibleFields = () =>
    props.data.field.allFields.filter(f => !isFieldHidden(f));

  return (
    <div
      class="malloy-table"
      classList={{
        'root': tableCtx.root,
        'scrolled': scrolling(),
      }}
      onScroll={handleScroll}
      style={getContainerStyle()}
    >
      {/* pinned header */}
      <Show when={tableCtx.root}>
        <div
          class="pinned-header-row"
          style={`grid-column: 1 / span ${tableCtx.layout.totalHeaderSize};`}
        >
          <For each={pinnedFields()}>
            {pinnedField => (
              <HeaderField field={pinnedField.field as Field} isPinned />
            )}
          </For>
        </div>
      </Show>
      {/* header */}
      <Show when={!tableCtx.root}>
        <div class="table-row" style={getRowStyle(-1)}>
          <For each={visibleFields()}>
            {field => <HeaderField field={field} />}
          </For>
        </div>
      </Show>
      {/* rows */}
      <For each={data()}>
        {(row, idx) => (
          <div class="table-row" style={getRowStyle(idx())}>
            <For each={visibleFields()}>
              {field => <TableField field={field} row={row} />}
            </For>
          </div>
        )}
      </For>
    </div>
  );
};

const MalloyTable: Component<{
  data: DataArray;
  rowLimit?: number;
  pinnedHeader?: boolean;
}> = props => {
  const metadata = useResultContext();
  const hasTableCtx = !!useTableContext();
  const tableCtx = createMemo(() => {
    if (hasTableCtx) {
      const parentCtx = useTableContext()!;

      return {
        root: false,
        pinnedHeader: props.pinnedHeader ?? parentCtx.pinnedHeader,
        layout: parentCtx.layout,
        autoRenameColumns: parentCtx.autoRenameColumns,
      };
    }

    // For now, only support turning columns off at root level.
    // This is due to an issue with pinned headers, which are always at root. So can't mix and match column renaming.
    // This can be fixed by moving the renaming detection into the TableLayout generator
    const autoRenameColumnsTag = () =>
      props.data.field.tagParse().tag.tag('table', 'auto_rename')?.text() ??
      metadata.resultTag.tag('table', 'auto_rename')?.text();

    return {
      root: true,
      pinnedHeader: props.pinnedHeader ?? false,
      layout: getTableLayout(metadata, props.data.field),
      autoRenameColumns: autoRenameColumnsTag() === 'off' ? false : true,
    };
  });

  return (
    <TableContext.Provider value={tableCtx()}>
      <MalloyTableRoot {...props} />
    </TableContext.Provider>
  );
};

export default MalloyTable;
