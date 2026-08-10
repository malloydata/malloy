/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {URLReader} from '@malloydata/malloy';
import * as fs from 'fs';
import {fileURLToPath} from 'url';

export class NodeURLReader implements URLReader {
  async readURL(url: URL): Promise<string> {
    if (url.protocol === 'file:') {
      const filePath = fileURLToPath(url);
      return fs.promises.readFile(filePath, 'utf-8');
    } else if (url.protocol === 'http:' || url.protocol === 'https:') {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${url}: ${response.status} ${response.statusText}`
        );
      }
      return response.text();
    } else {
      throw new Error(`Unsupported URL protocol: ${url.protocol}`);
    }
  }
}
