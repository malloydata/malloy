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
  private contents: Record<string, string> = {};

  setContents(url: string, value: string): void {
    this.contents[url] = value;
  }

  async readURL(url: URL): Promise<string> {
    const key = url.toString();
    if (key in this.contents) {
      return this.contents[key];
    } else {
      return fetchFile(url);
    }
  }
}
