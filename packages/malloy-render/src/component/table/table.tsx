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
} from 'solid-js';
import {DataArray, DataRecord, Field} from '@malloydata/malloy';
import {getFieldKey, isFirstChild, isLastChild} from '../util';
import {getTableLayout} from './table-layout';
import {useResultContext} from '../result-context';
import {TableContext, useTableContext} from './table-context';
import './table.css';
import {applyRenderer} from '../apply-renderer';

const Cell = (props: {
  field: Field;
  value: JSXElement;
  hideStartGutter: boolean;
  hideEndGutter: boolean;
  isHeader?: boolean;
}) => {
  const style = () => {
    const layout = useTableContext()!.layout;
    const width = layout[getFieldKey(props.field)].width;
    const height = layout[getFieldKey(props.field)].height;
    let style = '';
    if (!props.isHeader) {
      if (typeof width !== 'undefined') {
        style += `width: ${width}px; min-width: ${width}px; max-width: ${width}px;`;
        if (typeof height === 'number') {
          style += `height: ${height}px;`;
        }
      }
    }
    return style;
  };

  return (
    <div class="cell-wrapper">
      <div
        class="cell-gutter"
        classList={{
          'hide-gutter-border': props.hideStartGutter,
        }}
      ></div>
      <div
        class="cell-content"
        classList={{
          header: props.isHeader,
        }}
        style={style()}
      >
        {props.value}
      </div>
      <div
        class="cell-gutter"
        classList={{
          'hide-gutter-border': props.hideEndGutter,
        }}
      ></div>
    </div>
  );
};

const HeaderField = (props: {field: Field}) => {
  const isFirst = isFirstChild(props.field);
  const isParentFirst = isFirstChild(props.field.parentExplore);
  const isParentNotAField = !props.field.parentExplore.isExploreField();
  const hideStartGutter = isFirst && (isParentFirst || isParentNotAField);

  const isLast = isLastChild(props.field);
  const isParentLast = isLastChild(props.field.parentExplore);
  const hideEndGutter = isLast && (isParentLast || isParentNotAField);

  return (
    <th
      class="column-cell"
      classList={{
        numeric: props.field.isAtomicField() && props.field.isNumber(),
      }}
    >
      <Cell
        field={props.field}
        value={props.field.name}
        hideStartGutter={hideStartGutter}
        hideEndGutter={hideEndGutter}
        isHeader
      />
    </th>
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

  return (
    <td
      class="column-cell"
      classList={{
        numeric: props.field.isAtomicField() && props.field.isNumber(),
      }}
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
    </td>
  );
};

const MalloyTableRoot = (_props: {
  data: DataArray;
  rowLimit?: number;
  pinnedHeader?: boolean;
}) => {
  const props = mergeProps({rowLimit: Infinity, pinnedHeader: false}, _props);
  const tableCtx = useTableContext()!;

  const [scrolling, setScrolling] = createSignal(false);
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    setScrolling(target.scrollTop > 0);
  };

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

  return (
    <div
      onScroll={handleScroll}
      class="malloy-table"
      classList={{
        'root': tableCtx.root,
        'pinned-header': tableCtx.pinnedHeader,
        'scrolled': scrolling(),
      }}
    >
      <Show when={tableCtx.root}>
        <div class="sticky-header">
          <div class="sticky-header-content">
            <MalloyTable data={props.data} rowLimit={1} pinnedHeader={true} />
          </div>
        </div>
      </Show>
      <table>
        <thead>
          <tr>
            {props.data.field.allFields.map(f => (
              <HeaderField field={f} />
            ))}
          </tr>
        </thead>
        <tbody>
          <For each={data()}>
            {row => (
              <tr>
                {props.data.field.allFields.map(f => (
                  <TableField field={f} row={row} />
                ))}
              </tr>
            )}
          </For>
        </tbody>
      </table>
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
      };
    }
    return {
      root: true,
      pinnedHeader: props.pinnedHeader ?? false,
      layout: getTableLayout(metadata),
    };
  });

  return (
    <TableContext.Provider value={tableCtx()}>
      <MalloyTableRoot {...props} />
    </TableContext.Provider>
  );
};

export default MalloyTable;
