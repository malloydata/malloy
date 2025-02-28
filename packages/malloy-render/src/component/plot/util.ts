import * as Malloy from '@malloydata/malloy-interfaces';
import {getNestFields, isNest, NestFieldInfo, tagFor} from '../util';
import {RenderResultMetadata} from '../types';

export function walkFields(
  e: NestFieldInfo,
  cb: (f: Malloy.DimensionInfo) => void
) {
  getNestFields(e).forEach(f => {
    cb(f);
    if (isNest(f)) {
      walkFields(f, cb);
    }
  });
}

export function getFieldPathArrayFromRoot(
  f: Malloy.DimensionInfo,
  metadata: RenderResultMetadata
) {
  const path = metadata.fields.get(f)?.path;
  if (path === undefined) {
    throw new Error('Invalid field');
  }
  return path;
}

export function getFieldPathFromRoot(
  f: Malloy.DimensionInfo,
  metadata: RenderResultMetadata
) {
  return getFieldPathArrayFromRoot(f, metadata).join('.');
}

export function getFieldPathBetweenFields(
  parentField: NestFieldInfo,
  childField: Malloy.DimensionInfo,
  metadata: RenderResultMetadata
): string {
  const parentPath = getFieldPathArrayFromRoot(parentField, metadata);
  const childPath = getFieldPathArrayFromRoot(childField, metadata);
  const startIndex = parentPath.length;

  let i = 0;
  while (parentPath[i]) {
    if (parentPath[i] !== childPath[i])
      throw new Error(
        'Tried to get path from parent field to child field, but parent field is not a parent of child field.'
      );
    i++;
  }
  return childPath.slice(startIndex).join('.');
}

export function getFieldFromRootPath(
  root: NestFieldInfo,
  path: string
): Malloy.DimensionInfo {
  const pathParts = path.split('.');
  let curr: Malloy.DimensionInfo = root;
  for (const part of pathParts) {
    if (isNest(curr)) {
      curr = getNestFields(curr).find(f => f.name === part)!;
    } else {
      throw new Error('Tried to get field from path, but path is invalid');
    }
  }
  // TODO why is this here?
  // if (curr.isExplore() && !curr.isExploreField())
  //   throw new Error('Tried to get field from path, but got root Explore');
  return curr;
}

export function getFieldReferenceId(field: Malloy.DimensionInfo) {
  const tag = tagFor(field, '#(malloy) ');
  return tag.text('reference_id');
}
