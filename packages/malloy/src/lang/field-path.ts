/*
 * Copyright 2022 Google LLC
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

function undot(s: string): string[] {
  return s.split(".");
}
function redot(p: string[]): string {
  return p.join(".");
}

export function of(field: string): { head: string; tail: string } {
  const parts = undot(field);
  return {
    head: parts[0],
    tail: redot(parts.slice(1)),
  };
}

/**
 * First segment in a dotted path
 * @param field A dotted path name
 */
export function head(field: string): string {
  return undot(field)[0];
}

/**
 * A path with the "head" stripped off
 * @param field A dotted path name
 */
export function tail(field: string): string {
  return redot(undot(field).slice(1));
}

/**
 * A path with the last segment stripped off
 * @param field A dotted path name
 */
export function body(field: string): string {
  const parts = undot(field);
  return redot(parts.slice(0, parts.length - 1));
}

/**
 * Last segment in a dotted path
 * @param field A dotted path name
 */
export function foot(field: string): string {
  const parts = undot(field);
  return parts[parts.length - 1];
}

export function join(...parts: string[]): string {
  return parts.join(".");
}
