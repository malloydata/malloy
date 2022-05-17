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

export async function wrapErrors<T>(
  fn: () => T
): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    return { error: error.message };
  }
}
