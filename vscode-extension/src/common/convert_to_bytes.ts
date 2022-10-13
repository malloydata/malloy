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

const BYTE_SUFFIXES = ["k", "m", "g", "t", "p"];
const BYTE_MATCH = /^(?<bytes>\d+)((?<suffix>[kmgtp])((?<iec>i)?b)?)?$/i;

export const convertToBytes = (bytes: string): string => {
  const match = BYTE_MATCH.exec(bytes);
  if (match?.groups?.suffix) {
    const value =
      +match.groups.bytes *
      Math.pow(
        1024,
        BYTE_SUFFIXES.indexOf(match.groups.suffix.toLowerCase()) + 1
      );
    return `${value}`;
  }
  return bytes;
};
