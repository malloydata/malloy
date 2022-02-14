/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

/**
 * When walking a field path, return the segment being walked
 * and the remaining segments for recursion.
 * @param field Dotted field name
 * @returns feld as { head: string; tail: string }
 */
export function walk(field: string): { head: string; tail: string } {
  const dot = field.indexOf(".");
  if (dot >= 0) {
    return {
      head: field.slice(0, dot),
      tail: field.slice(dot + 1),
    };
  }
  return { head: field, tail: "" };
}

/**
 * If the fieldPath is not just a field, the returns the path to the field
 * @param fieldPath A dotted path name
 */
export function path(fieldPath: string): string {
  const lastDot = fieldPath.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }
  return fieldPath.slice(0, lastDot);
}

/**
 * Last segment in a dotted path
 * @param fieldPath A dotted path name
 */
export function field(fieldPath: string): string {
  const lastDot = fieldPath.lastIndexOf(".");
  return fieldPath.slice(lastDot + 1);
}
