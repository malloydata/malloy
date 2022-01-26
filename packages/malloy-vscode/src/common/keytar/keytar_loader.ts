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
/* eslint-disable @typescript-eslint/no-explicit-any */

export type KeytarModule = {
  default: typeof import("/Users/bporterfield/dev/malloy/node_modules/keytar/keytar");
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<any>;
  deletePassword(service: string, account: string): Promise<any>;
  findPassword(service: string): Promise<any>;
  findCredentials(service: string): Promise<any>;
};

// in production the extension is packaged with native keytar lib targeted to a specific platform,
// so grab the local binary. Otherwise, load keytar from node_modules like normal
export async function loadKeytar(): Promise<KeytarModule> {
  return process.env.NODE_ENV == "production"
    ? await require("./keytar-native")
    : await import("keytar");
}
