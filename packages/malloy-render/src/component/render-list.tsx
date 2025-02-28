import {For} from 'solid-js';
import {applyRenderer, RendererProps} from './apply-renderer';
import {
  getCell,
  getNestFields,
  isNest,
  NestFieldInfo,
  tagFor,
  valueIsNull,
} from './util';
import {isFieldHidden} from '../tags_utils';
import * as Malloy from '@malloydata/malloy-interfaces';

export function renderList(props: RendererProps) {
  if (valueIsNull(props.dataColumn)) return '∅';
  const listTag = props.tag.tag('list');
  const listDetailTag = props.tag.tag('list_detail');
  if (!listTag && !listDetailTag)
    throw new Error('Missing tag for List renderer');
  if (!isNest(props.field))
    throw new Error('List renderer: Field must be ExploreField');
  const fieldAsNest = props.field as NestFieldInfo;
  if (props.dataColumn.kind !== 'array_cell')
    throw new Error('List renderer: DataColumn must be DataArray');
  const nonHiddenFields = getNestFields(fieldAsNest).filter(field => {
    return !isFieldHidden(field);
  });
  const valueField = nonHiddenFields[0];

  const isListDetail = !!listDetailTag;
  const descriptionField = nonHiddenFields[1];
  const rows: Malloy.Row[] = [];
  for (const row of props.dataColumn.array_value) {
    if (row.kind !== 'record_cell') {
      throw new Error('List renderer: Row must be DataRecord');
    }
    rows.push(row.record_value);
  }

  return (
    <div
      class="malloy-list"
      style="text-wrap: wrap; line-height: calc(var(--malloy-render--table-row-height) * 5 / 7 - 1px);"
    >
      <For each={rows}>
        {(row, idx) => (
          <span>
            {
              applyRenderer({
                field: valueField,
                dataColumn: getCell(fieldAsNest, row, valueField.name),
                resultMetadata: props.resultMetadata,
                tag: tagFor(valueField),
              }).renderValue
            }
            {isListDetail &&
              descriptionField &&
              '(' +
                applyRenderer({
                  field: descriptionField,
                  dataColumn: getCell(fieldAsNest, row, descriptionField.name),
                  resultMetadata: props.resultMetadata,
                  tag: tagFor(descriptionField),
                }).renderValue +
                ')'}
            {idx() < rows.length - 1 && ', '}
          </span>
        )}
      </For>
    </div>
  );
}
