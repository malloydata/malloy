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

import { FieldDef, ResultJSON } from "@malloydata/malloy";
import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
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
    shell.openExternal(_navigationUrl);
  });
});

async function registerIPC(): Promise<void> {
  ipcMain.handle("get:analyses", async (_event, path) => {
    try {
      return await readMalloyDirectory(path);
    } catch (error) {
      return error;
    }
  });

  ipcMain.handle("get:analysis", async (_event, path) => {
    try {
      return await getAnalysis(path);
    } catch (error) {
      return error;
    }
  });

  ipcMain.handle("get:models", async () => {
    try {
      return getModels();
    } catch (error) {
      return error;
    }
  });

  ipcMain.handle("get:schema", async (_event, analysis: Analysis) => {
    try {
      return await getSchema(analysis);
    } catch (error) {
      return error;
    }
  });

  ipcMain.handle(
    "post:run_query",
    async (
      _event,
      query: string,
      queryName: string,
      analysis: Analysis
    ): Promise<ResultJSON | Error> => {
      try {
        return (await runQuery(query, queryName, analysis)).toJSON();
      } catch (error) {
        return error;
      }
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
      try {
        return await saveField(type, field, name, analysis);
      } catch (error) {
        return error;
      }
    }
  );

  ipcMain.handle(
    "post:search",
    async (_event, source, analysisPath, searchTerm, fieldPath) => {
      try {
        return await searchIndex(source, analysisPath, searchTerm, fieldPath);
      } catch (error) {
        return error;
      }
    }
  );

  ipcMain.handle("post:top_values", async (_event, source, analysisPath) => {
    try {
      return await topValues(source, analysisPath);
    } catch (error) {
      return error;
    }
  });

  ipcMain.handle("post:open_directory", async (_event) => {
    try {
      return await getOpenDirectory();
    } catch (error) {
      return error;
    }
  });

  ipcMain.handle("post:open_link", async (_event, url) => {
    shell.openExternal(url);
  });

  // Native application menu
  const template: (Electron.MenuItem | Electron.MenuItemConstructorOptions)[] =
    [
      { role: "appMenu" },
      { role: "fileMenu" },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
          { type: "separator" },
          {
            label: "View Open Source Licenses",
            click: async () => {
              const thirdPartyWindow = new BrowserWindow({
                width: 400,
                height: 600,
                webPreferences: {
                  javascript: false,
                },
              });

              thirdPartyWindow.setMenu(null);

              thirdPartyWindow.loadURL(
                url.format({
                  pathname: app.isPackaged
                    ? path.join(
                        process.resourcesPath,
                        "third_party_notices.txt"
                      )
                    : path.join(__dirname, "app", "not_packaged.html"),
                  protocol: "file",
                  slashes: true,
                })
              );
            },
          },
        ],
      },
      { role: "windowMenu" },
      {
        label: "Help",
        submenu: [
          {
            label: "Open Malloy Documentation",
            click: async () => {
              await shell.openExternal(
                "https://looker-open-source.github.io/malloy/documentation/index.html"
              );
            },
          },
        ],
      },
    ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
