import {Tag} from '@malloydata/malloy/src';

export function hasAny(tag: Tag, ...paths: Array<string | string[]>): boolean {
  return paths.some(path =>
    Array.isArray(path) ? tag.has(...path) : tag.has(path)
  );
}
