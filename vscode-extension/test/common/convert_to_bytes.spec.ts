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

import { convertToBytes } from "../../src/common/convert_to_bytes";

describe("convertToBytes()", () => {
  it.each([
    ["numbers", ["1024", "1024"], ["20480", "20480"], ["409600", "409600"]],
    ["kB", ["1k", "1024"], ["20kB", "20480"], ["400kib", "409600"]],
    ["MB", ["1M", "1048576"], ["20MB", "20971520"], ["400mib", "419430400"]],
    [
      "GB",
      ["1G", "1073741824"],
      ["20GB", "21474836480"],
      ["400gib", "429496729600"],
    ],
    [
      "TB",
      ["1T", "1099511627776"],
      ["20TB", "21990232555520"],
      ["400tib", "439804651110400"],
    ],
    [
      "PB",
      ["1P", "1125899906842624"],
      ["20PB", "22517998136852480"],
      ["400pib", "450359962737049600"],
    ],
    ["garbage", ["1F", "1F"], ["2KX", "2KX"], ["Fred", "Fred"]],
  ])("Handles %s", (_name, a, b, c) => {
    expect(convertToBytes(a[0])).toEqual(a[1]);
    expect(convertToBytes(b[0])).toEqual(b[1]);
    expect(convertToBytes(c[0])).toEqual(c[1]);
  });
});
