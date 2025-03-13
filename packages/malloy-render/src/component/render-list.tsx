import {For} from 'solid-js';
import {applyRenderer} from './apply-renderer';
import type {RendererProps} from './types';

export function renderList(props: RendererProps) {
  if (props.dataColumn.isNull()) return '∅';
  const listTag = props.tag.tag('list');
  const listDetailTag = props.tag.tag('list_detail');
  if (!listTag && !listDetailTag)
    throw new Error('Missing tag for List renderer');
  if (!props.dataColumn.field.isNest())
    throw new Error('List renderer: Field must be ExploreField');
  // TODO make this work for Arrays as well using `dataColumn.values`
  if (!props.dataColumn.isRepeatedRecord())
    throw new Error('List renderer: DataColumn must be RepeatedRecord');
  const nonHiddenFields = props.dataColumn.field.fields.filter(field => {
    return !field.isHidden();
  });
  const valueField = nonHiddenFields[0];

  const isListDetail = !!listDetailTag;
  const descriptionField = nonHiddenFields[1];
  const rows = props.dataColumn.rows;

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
                dataColumn: row.column(valueField.name),
                tag: valueField.tag,
              }).renderValue
            }
            {isListDetail &&
              descriptionField &&
              '(' +
                applyRenderer({
                  dataColumn: row.column(descriptionField.name),
                  tag: descriptionField.tag,
                }).renderValue +
                ')'}
            {idx() < rows.length - 1 && ', '}
          </span>
        )}
      </For>
    </div>
  );
}
