import {DataArray, DataRecord, Field} from '@malloydata/malloy';
import './dashboard.css';
import {createMemo, For} from 'solid-js';
import {applyRenderer} from '../apply-renderer';
import {useResultContext} from '../result-context';
import {RenderResultMetadata} from '../types';
import {createVirtualizer, Virtualizer} from '@tanstack/solid-virtual';
import {useConfig} from '../render';

function DashboardItem(props: {
  field: Field;
  row: DataRecord;
  resultMetadata: RenderResultMetadata;
  isMeasure?: boolean;
}) {
  const rendering = applyRenderer({
    field: props.field,
    dataColumn: props.row.cell(props.field),
    tag: props.field.tagParse().tag,
    resultMetadata: props.resultMetadata,
    customProps: {
      table: {
        disableVirtualization: true,
      },
    },
  });

  const config = useConfig();
  const handleClick = (evt: MouseEvent) => {
    if (config.onClick)
      config.onClick({
        field: props.field,
        displayValue:
          typeof rendering.renderValue !== 'function'
            ? rendering.renderValue
            : null,
        value: props.row.cell(props.field).value,
        fieldPath: props.field.fieldPath,
        isHeader: false,
        event: evt,
        type: 'dashboard-item',
      });
  };

  return (
    <div
      class="dashboard-item"
      onClick={config.onClick ? handleClick : undefined}
    >
      <div class="dashboard-item-title">{props.field.name}</div>
      <div
        class="dashboard-item-value"
        classList={{
          'dashboard-item-value-measure': props.isMeasure,
        }}
      >
        {rendering.renderValue}
      </div>
    </div>
  );
}

export function Dashboard(props: {data: DataArray; scrollEl?: HTMLElement}) {
  const field = () => props.data.field;

  const dimensions = () =>
    field().allFields.filter(f => {
      const isHidden = f.tagParse().tag.has('hidden');
      return !isHidden && f.isAtomicField() && f.sourceWasDimension();
    });

  const nonDimensions = () => {
    const measureFields: Field[] = [];
    const otherFields: Field[] = [];

    for (const f of field().allFields) {
      if (f.tagParse().tag.has('hidden')) continue;
      if (f.isAtomicField() && f.sourceWasMeasureLike()) {
        measureFields.push(f);
      } else if (!f.isAtomicField() || !f.sourceWasDimension())
        otherFields.push(f);
    }
    return [...measureFields, ...otherFields];
  };

  const nonDimensionsGrouped = () => {
    const group: Field[][] = [[]];
    for (const f of nonDimensions()) {
      const {tag} = f.tagParse();
      if (tag.has('break')) {
        group.push([]);
      }
      const lastGroup = group.at(-1)!;
      lastGroup.push(f);
    }
    return group;
  };

  const data = createMemo(() => {
    const data: DataRecord[] = [];
    for (const row of props.data) {
      data.push(row);
    }
    return data;
  });

  let scrollEl!: HTMLElement;
  if (props.scrollEl) scrollEl = props.scrollEl;
  const virtualizer: Virtualizer<HTMLElement, Element> = createVirtualizer({
    count: data().length,
    getScrollElement: () => scrollEl,
    estimateSize: () => 192,
  });
  const items = virtualizer.getVirtualItems();

  const resultMetadata = useResultContext();

  return (
    <div
      class="malloy-dashboard"
      ref={el => {
        if (!props.scrollEl) scrollEl = el;
      }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize() + 'px',
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
                ref={el => queueMicrotask(() => virtualizer.measureElement(el))}
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
                                dataColumn: data()[virtualRow.index].cell(d),
                                tag: d.tagParse().tag,
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
                            field={field}
                            row={data()[virtualRow.index]}
                            resultMetadata={resultMetadata}
                            isMeasure={
                              field.isAtomicField() &&
                              field.sourceWasMeasureLike()
                            }
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
    </div>
  );
}
