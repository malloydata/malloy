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

import * as fs from "fs";

import { CSVWriter, JSONWriter, Runtime } from "@malloydata/malloy";

import { log } from "./logger";
import { MessageDownload, WorkerDownloadMessage } from "./types";
import { createRunnable } from "./utils";
import { WorkerURLReader } from "./files";
import { CONNECTION_MANAGER } from "../server/connections";

const sendMessage = (name: string, error?: string) => {
  const msg: WorkerDownloadMessage = {
    type: "download",
    name,
    error,
  };
  process.send?.(msg);
};

export async function downloadQuery({
  query,
  panelId,
  downloadOptions,
  name,
  filePath,
}: MessageDownload): Promise<void> {
  const files = new WorkerURLReader();
  const url = new URL(panelId);

  try {
    const runtime = new Runtime(
      files,
      CONNECTION_MANAGER.getConnectionLookup(url)
    );

    const runnable = createRunnable(query, runtime);
    const writeStream = fs.createWriteStream(filePath);
    const writer =
      downloadOptions.format === "json"
        ? new JSONWriter(writeStream)
        : new CSVWriter(writeStream);
    const rowLimit =
      typeof downloadOptions.amount === "number"
        ? downloadOptions.amount
        : undefined;
    const rowStream = runnable.runStream({
      rowLimit,
    });
    await writer.process(rowStream);
    sendMessage(name);
  } catch (error) {
    sendMessage(name, error.message);
  }
}
