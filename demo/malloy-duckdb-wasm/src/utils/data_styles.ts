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
import { DataStyles } from "@malloydata/render";

import { fetchFile } from "./files";

export function compileDataStyles(styles: string): DataStyles {
  try {
    return JSON.parse(styles) as DataStyles;
  } catch (error) {
    throw new Error(`Error compiling data styles: ${error.message}`);
  }
}

// TODO replace this with actual JSON metadata import functionality, when it exists
export async function dataStylesForFile(
  uri: string,
  text: string
): Promise<DataStyles> {
  const PREFIX = "--! styles ";
  let styles: DataStyles = {};
  for (const line of text.split("\n")) {
    if (line.startsWith(PREFIX)) {
      const fileName = line.trimEnd().substring(PREFIX.length);
      // TODO instead of failing silently when the file does not exist, perform this after the WebView has been
      //      created, so that the error can be shown there.
      let stylesText;
      try {
        stylesText = await fetchFile(new URL(fileName, window.location.href));
      } catch (error) {
        console.error(`Error loading data style '${fileName}': ${error}`);
        stylesText = "{}";
      }
      styles = { ...styles, ...compileDataStyles(stylesText) };
    }
  }

  return styles;
}

// TODO Come up with a better way to handle data styles. Perhaps this is
//      an in-language understanding of model "metadata". For now,
//      we abuse the `URLReader` API to keep track of requested URLs
//      and accumulate data styles for those files.
export class HackyDataStylesAccumulator implements URLReader {
  private uriReader: URLReader;
  private dataStyles: DataStyles = {};

  constructor(uriReader: URLReader) {
    this.uriReader = uriReader;
  }

  async readURL(uri: URL): Promise<string> {
    const contents = await this.uriReader.readURL(uri);
    this.dataStyles = {
      ...this.dataStyles,
      ...(await dataStylesForFile(uri.toString(), contents)),
    };

    return contents;
  }

  getHackyAccumulatedDataStyles(): DataStyles {
    return this.dataStyles;
  }
}
