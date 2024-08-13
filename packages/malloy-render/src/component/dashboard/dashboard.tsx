import {DataArray, DataRecord, Field} from '@malloydata/malloy';
import './dashboard.css';
import {createMemo, For} from 'solid-js';
import {applyRenderer} from '../apply-renderer';
import {useResultContext} from '../result-context';
import {RenderResultMetadata} from '../types';

function DashboardItem(props: {
  field: Field;
  row: DataRecord;
  resultMetadata: RenderResultMetadata;
  getFieldDisplayName: (f: Field) => string;
  isMeasure?: boolean;
}) {
  return (
    <div class="dashboard-item">
      <div class="dashboard-item-title">
        {props.getFieldDisplayName(props.field)}
      </div>
      <div
        class="dashboard-item-value"
        classList={{
          'dashboard-item-value-measure': props.isMeasure,
        }}
      >
        {
          applyRenderer({
            field: props.field,
            dataColumn: props.row.cell(props.field),
            tag: props.field.tagParse().tag,
            resultMetadata: props.resultMetadata,
          }).renderValue
        }
      </div>
    </div>
  );
}

export function Dashboard(props: {data: DataArray}) {
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

  const data = createMemo(() => {
    const data: DataRecord[] = [];
    for (const row of props.data) {
      data.push(row);
    }
    return data;
  });

  const resultMetadata = useResultContext();
  const disableAutoRename =
    resultMetadata.resultTag.tag('dashboard', 'auto_rename')?.text() === 'off';
  const getFieldDisplayName = (f: Field) => {
    return disableAutoRename ? f.name : f.name.replace(/_/g, ' ');
  };

  return (
    <div class="malloy-dashboard">
      <For each={data()}>
        {row => (
          <div class="dashboard-row">
            <div class="dashboard-row-header">
              <div class="dashboard-row-header-dimension-list">
                <For each={dimensions()}>
                  {d => (
                    <div class="dashboard-dimension-wrapper">
                      <div class="dashboard-dimension-name">
                        {getFieldDisplayName(d)}
                      </div>
                      <div class="dashboard-dimension-value">
                        {row.cell(d).value as string}
                      </div>
                    </div>
                  )}
                </For>
              </div>
              <div class="dashboard-row-header-separator" />
              {/* <hr class="dashboard-row-head" /> */}
            </div>
            <div class="dashboard-row-body">
              <For each={nonDimensions()}>
                {field => (
                  <DashboardItem
                    field={field}
                    row={row}
                    resultMetadata={resultMetadata}
                    getFieldDisplayName={getFieldDisplayName}
                    isMeasure={
                      field.isAtomicField() && field.sourceWasMeasureLike()
                    }
                  />
                )}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
