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

import {
  CSVWriter,
  JSONWriter,
  QueryMaterializer,
  SQLBlockMaterializer,
} from "@malloydata/malloy";
import { QueryDownloadOptions } from "../webview_message_manager";

import * as vscode from "vscode";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

export async function queryDownload(
  query: SQLBlockMaterializer | QueryMaterializer,
  downloadOptions: QueryDownloadOptions,
  defaultRowLimit: number | undefined,
  name?: string
): Promise<void> {
  const rawDownloadPath = vscode.workspace
    .getConfiguration("malloy")
    .get("downloadsPath");
  const relativeDownloadPath =
    rawDownloadPath === undefined || typeof rawDownloadPath !== "string"
      ? "~/Downloads"
      : rawDownloadPath;
  const downloadPath = relativeDownloadPath.startsWith(".")
    ? path.resolve(relativeDownloadPath)
    : relativeDownloadPath.startsWith("~")
    ? relativeDownloadPath.replace(/^~/, os.homedir())
    : relativeDownloadPath;
  if (!fs.existsSync(downloadPath)) {
    vscode.window.showErrorMessage(
      `Download path ${downloadPath} does not exist.`
    );
    return;
  }

  const fileExtension = downloadOptions.format === "json" ? "json" : "csv";
  const rawFilePath = path.join(downloadPath, `${name}.${fileExtension}`);
  const filePath = dedupFileName(rawFilePath);
  const rowLimit =
    downloadOptions.amount === "all"
      ? undefined
      : downloadOptions.amount === "current"
      ? defaultRowLimit
      : downloadOptions.amount;
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Malloy Download (${name})`,
      cancellable: false,
    },
    async () => {
      const rowStream = query.runStream({
        rowLimit,
      });
      const writeStream = fs.createWriteStream(filePath);
      const writer =
        downloadOptions.format === "json"
          ? new JSONWriter(writeStream)
          : new CSVWriter(writeStream);
      await writer.process(rowStream);
    }
  );
}

function dedupFileName(absolutePath: string) {
  let index = 0;
  let attempt = absolutePath;
  const parsed = path.parse(absolutePath);
  const extension = parsed.ext;
  const fileName = parsed.name;
  const directory = parsed.dir;
  while (fs.existsSync(attempt)) {
    index++;
    attempt = path.join(directory, `${fileName}_${index}${extension}`);
  }
  return attempt;
}
