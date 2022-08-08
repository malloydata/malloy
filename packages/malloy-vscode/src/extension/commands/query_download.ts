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

import {
  CSVWriter,
  JSONWriter,
  QueryMaterializer,
  Result,
  SQLBlockMaterializer,
} from "@malloydata/malloy";
import { QueryDownloadOptions } from "../message_types";

import * as vscode from "vscode";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

export async function queryDownload(
  query: SQLBlockMaterializer | QueryMaterializer,
  downloadOptions: QueryDownloadOptions,
  currentResults: Result,
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
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Malloy Download (${name})`,
      cancellable: false,
    },
    async () => {
      try {
        const writeStream = fs.createWriteStream(filePath);
        const writer =
          downloadOptions.format === "json"
            ? new JSONWriter(writeStream)
            : new CSVWriter(writeStream);
        let rowStream;
        if (downloadOptions.amount === "current") {
          rowStream = currentResults.data.inMemoryStream();
        } else {
          const rowLimit =
            downloadOptions.amount === "all"
              ? undefined
              : downloadOptions.amount;
          rowStream = query.runStream({
            rowLimit,
          });
        }
        await writer.process(rowStream);
        vscode.window.showInformationMessage(
          `Malloy Download (${name}): Complete`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Malloy Download (${name}): Error\n${error.message}`
        );
      }
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
