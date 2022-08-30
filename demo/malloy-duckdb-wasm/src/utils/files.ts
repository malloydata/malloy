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

import { URLReader } from "@malloydata/malloy";

export const fetchFile = async (url: URL): Promise<string> => {
  console.log("Reading", url);
  const body = await fetch(url);
  return body.text();
};

export class BrowserURLReader implements URLReader {
  async readURL(url: URL): Promise<string> {
    return fetchFile(url);
  }
}
