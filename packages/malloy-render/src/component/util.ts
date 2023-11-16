import {Explore, Field} from '@malloydata/malloy';

function getLocationInParent(f: Field | Explore) {
  const parent = f.parentExplore;
  return parent?.allFields.findIndex(pf => pf.name === f.name) ?? -1;
}

export function isLastChild(f: Field | Explore) {
  if (f.parentExplore)
    return getLocationInParent(f) === f.parentExplore.allFields.length - 1;
  return true;
}

export function isFirstChild(f: Field | Explore) {
  return getLocationInParent(f) === 0;
}
