import {Explore, ExploreField, Field} from '@malloydata/malloy';

export function walkFields(e: Explore, cb: (f: Field) => void) {
  e.allFields.forEach(f => {
    cb(f);
    if (f.isExplore()) {
      walkFields(f, cb);
    }
  });
}

export function getFieldPathArrayFromRoot(f: Field | Explore) {
  const paths = f.isExplore() && !f.isExploreField() ? [] : [f.name];
  let parent = f.parentExplore;
  while (parent?.isExploreField()) {
    paths.unshift(parent.name);
    parent = parent.parentExplore;
  }
  return paths;
}

export function getFieldPathFromRoot(f: Field | Explore) {
  return getFieldPathArrayFromRoot(f).join('.');
}

export function getFieldPathBetweenFields(
  parentField: Field | Explore,
  childField: Field | Explore
): string {
  const parentPath = getFieldPathArrayFromRoot(parentField);
  const childPath = getFieldPathArrayFromRoot(childField);
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

export function getFieldFromRootPath(root: Explore, path: string): Field {
  const pathParts = path.split('.');
  let curr: Field | ExploreField | Explore = root;
  for (const part of pathParts) {
    if (curr.isExplore()) {
      curr = curr.allFields.find(f => f.name === part)!;
    } else {
      throw new Error('Tried to get field from path, but path is invalid');
    }
  }
  if (curr.isExplore() && !curr.isExploreField())
    throw new Error('Tried to get field from path, but got root Explore');
  return curr;
}
