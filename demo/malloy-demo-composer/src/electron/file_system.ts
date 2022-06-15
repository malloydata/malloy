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

import { dialog } from "electron";

export async function getOpenDirectory(): Promise<string | undefined> {
  const { filePaths } = await dialog.showOpenDialog({
    title: "Open Malloy Workspace",
    buttonLabel: "Open",
    filters: [],
    properties: ["openDirectory"],
    message: "Choose a directory to open as a Malloy Workspace",
  });

  if (filePaths.length === 1) {
    return filePaths[0];
  }

  return undefined;
}
