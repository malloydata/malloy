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

import { FieldDef } from "@malloydata/malloy";
import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import url from "url";
import { getAnalysis, readMalloyDirectory } from "./directory";
import { getModels } from "./models";
import { runQuery } from "./run_query";
import { saveField } from "./save_query";
import { getSchema } from "./schema";
import { searchIndex } from "./search";
import { topValues } from "./top_values";
import { Analysis } from "../types";
import { getOpenDirectory } from "./file_system";

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const appURL = app.isPackaged
    ? url.format({
        pathname: path.join(__dirname, "app", "index.html"),
        protocol: "file:",
        slashes: true,
      })
    : "http://localhost:3000";
  mainWindow.loadURL(appURL);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: "detach", activate: false });
  }

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  registerIPC();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// No navigation anywhere!
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, _navigationUrl) => {
    event.preventDefault();
  });
});

async function registerIPC(): Promise<void> {
  ipcMain.handle("get:analyses", async (_event, path) => {
    return await readMalloyDirectory(path);
  });

  ipcMain.handle("get:analysis", async (_event, path) => {
    return await getAnalysis(path);
  });

  ipcMain.handle("get:models", async () => getModels);

  ipcMain.handle("get:schema", async (_event, analysis: Analysis) => {
    return await getSchema(analysis);
  });

  ipcMain.handle(
    "post:run_query",
    async (_event, query: string, queryName: string, analysis: Analysis) => {
      return (await runQuery(query, queryName, analysis)).toJSON();
    }
  );

  ipcMain.handle(
    "post:save_field",
    async (
      _event,
      type: "query" | "dimension" | "measure",
      field: FieldDef,
      name: string,
      analysis: Analysis
    ) => {
      return await saveField(type, field, name, analysis);
    }
  );

  ipcMain.handle(
    "post:search",
    async (_event, source, analysisPath, searchTerm, fieldPath) => {
      return await searchIndex(source, analysisPath, searchTerm, fieldPath);
    }
  );

  ipcMain.handle("post:top_values", async (_event, source, analysisPath) => {
    return await topValues(source, analysisPath);
  });

  ipcMain.handle("post:open_directory", async (_event) => {
    return await getOpenDirectory();
  });
}
