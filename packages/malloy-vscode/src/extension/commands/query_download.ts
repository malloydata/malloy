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

import { CSVWriter, JSONWriter, Result } from "@malloydata/malloy";
import { QueryDownloadOptions } from "../message_types";
import { getWorker } from "../extension";

import * as vscode from "vscode";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { QuerySpec } from "./run_query_utils";
import {
  MessageDownload,
  WorkerMessage,
  WorkerQuerySpec,
} from "../../worker/types";

const sendDownloadMessage = (
  query: WorkerQuerySpec,
  panelId: string,
  name: string,
  filePath: string,
  downloadOptions: QueryDownloadOptions
) => {
  const worker = getWorker();
  const message: MessageDownload = {
    type: "download",
    query,
    panelId,
    name,
    filePath,
    downloadOptions,
  };
  worker.send?.(message);
};

export async function queryDownload(
  query: QuerySpec,
  downloadOptions: QueryDownloadOptions,
  currentResults: Result,
  panelId: string,
  name: string
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
        if (downloadOptions.amount === "current") {
          const writeStream = fs.createWriteStream(filePath);
          const writer =
            downloadOptions.format === "json"
              ? new JSONWriter(writeStream)
              : new CSVWriter(writeStream);
          const rowStream = currentResults.data.inMemoryStream();
          await writer.process(rowStream);
          vscode.window.showInformationMessage(
            `Malloy Download (${name}): Complete`
          );
        } else {
          const worker = getWorker();
          const { file, ...params } = query;
          const fsPath = file.uri.fsPath;
          sendDownloadMessage(
            {
              file: fsPath,
              ...params,
            },
            panelId,
            name,
            filePath,
            downloadOptions
          );
          const listener = (msg: WorkerMessage) => {
            if (msg.type === "dead") {
              vscode.window.showErrorMessage(
                `Malloy Download (${name}): Error\nWorker died`
              );

              worker.off("message", listener);
              return;
            } else if (msg.type !== "download") {
              return;
            }
            const { name: msgName, error } = msg;
            if (msgName !== name) {
              return;
            }
            if (error) {
              vscode.window.showErrorMessage(
                `Malloy Download (${name}): Error\n${error}`
              );
            } else {
              vscode.window.showInformationMessage(
                `Malloy Download (${name}): Complete`
              );
            }
            worker.off("message", listener);
          };

          worker.on("message", listener);
        }
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
