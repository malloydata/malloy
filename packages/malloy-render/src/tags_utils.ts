import {Field} from '@malloydata/malloy';

export function isFieldHidden(field: Field) {
  return field.getTags().getMalloyTags().properties['hidden'];
}
