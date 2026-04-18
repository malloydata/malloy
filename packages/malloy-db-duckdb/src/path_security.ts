/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';
import path from 'path';

export interface CanonicalPathOptions {
  mustExist?: boolean;
}

export function isPosixHost(): boolean {
  return path.sep === '/';
}

export function canonicalizePath(
  input: string,
  {mustExist = false}: CanonicalPathOptions = {}
): string {
  if (input.trim() === '') {
    throw new Error('path must not be empty');
  }

  const resolved = path.resolve(input);
  const canonical = (() => {
    try {
      return fs.realpathSync.native(resolved);
    } catch (error) {
      if (mustExist || !isENOENT(error)) {
        throw error;
      }
      return canonicalizeMissingPath(resolved);
    }
  })();

  return stripTrailingSeparator(path.normalize(canonical));
}

export function canonicalizePathList(paths: string[]): string[] {
  return Array.from(new Set(paths.map(p => canonicalizePath(p)).sort()));
}

export function isContainedPath(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function canonicalizeMissingPath(resolved: string): string {
  const parent = path.dirname(resolved);
  if (parent === resolved) {
    return resolved;
  }

  const realParent = (() => {
    try {
      return fs.realpathSync.native(parent);
    } catch (error) {
      if (!isENOENT(error)) {
        throw error;
      }
      return canonicalizeMissingPath(parent);
    }
  })();

  return path.join(realParent, path.basename(resolved));
}

function isENOENT(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function stripTrailingSeparator(value: string): string {
  const root = path.parse(value).root;
  if (value === root) {
    return value;
  }

  let end = value.length;
  while (end > root.length && isPathSeparator(value.charCodeAt(end - 1))) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

function isPathSeparator(charCode: number): boolean {
  return charCode === 47 || charCode === 92;
}
