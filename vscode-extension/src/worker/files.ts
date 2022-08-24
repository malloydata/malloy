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
import { fileURLToPath } from "url";
import { Message } from "./types";

let idx = 1;

/**
 * Requests a file from the worker's controller. Although the
 * file path is a file system path, reading the file off
 * disk doesn't take into account unsaved changes that only
 * VS Code is aware of.
 *
 * @param file File path to resolve
 * @returns File contents
 */
export async function fetchFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // This could probably use some more error handling (timeout?).
    // For now just be relentlessly optimistic because there's
    // a tight coupling with the worker controller.
    const id = `${file}-${idx++}`;
    const callback = (message: Message) => {
      if (message.type === "read" && message.id === id) {
        if (message.data != null) {
          resolve(message.data);
        } else if (message.error != null) {
          reject(new Error(message.error));
        }
        process.off("message", callback);
      }
    };
    process.on("message", callback);
    process.send?.({
      type: "read",
      file,
      id,
    });
  });
}

export class WorkerURLReader implements URLReader {
  async readURL(url: URL): Promise<string> {
    return fetchFile(fileURLToPath(url));
  }
}
