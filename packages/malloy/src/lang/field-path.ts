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
 * A path with the last segment stripped off
 * @param field A dotted path name
 */
export function body(field: string): string {
  const lastDot = field.lastIndexOf(".");
  if (lastDot >= 0) {
    return field.slice(0, lastDot);
  }
  return field;
}

/**
 * Last segment in a dotted path
 * @param field A dotted path name
 */
export function foot(field: string): string {
  const lastDot = field.lastIndexOf(".");
  return field.slice(lastDot + 1);
}
