import {DataRecord, ExploreField} from '@malloydata/malloy';
import {For} from 'solid-js';
import {applyRenderer, RendererProps} from './apply-renderer';

export function renderList(props: RendererProps) {
  if (props.dataColumn.isNull()) return '∅';
  const listTag = props.tag.tag('list');
  const listDetailTag = props.tag.tag('list_detail');
  if (!listTag && !listDetailTag)
    throw new Error('Missing tag for List renderer');
  if (!props.field.isExplore())
    throw new Error('List renderer: Field must be ExploreField');
  if (!props.dataColumn.isArray())
    throw new Error('List renderer: DataColumn must be DataArray');
  const valueField = props.field.allFields.filter(field => {
    const {tag} = field.tagParse();
    return !tag.has('hidden');
  })[0];

  const isListDetail = !!listDetailTag;
  const descriptionField = (props.field as ExploreField).allFields.filter(
    field => {
      const {tag} = field.tagParse();
      return !tag.has('hidden');
    }
  )[1];
  const rows: DataRecord[] = [];
  for (const row of props.dataColumn) {
    rows.push(row);
  }

  // TODO: width estimator for list renderer? and others
  return (
    <div style="text-wrap: wrap;">
      <For each={rows}>
        {(row, idx) => (
          <span>
            {
              applyRenderer({
                field: valueField,
                dataColumn: row.cell(valueField),
                resultMetadata: props.resultMetadata,
                tag: valueField.tagParse().tag,
              }).renderValue
            }
            {isListDetail &&
              descriptionField &&
              '(' +
                applyRenderer({
                  field: descriptionField,
                  dataColumn: row.cell(descriptionField),
                  resultMetadata: props.resultMetadata,
                  tag: descriptionField.tagParse().tag,
                }).renderValue +
                ')'}
            {idx() < rows.length - 1 && ', '}
          </span>
        )}
      </For>
    </div>
  );
}
