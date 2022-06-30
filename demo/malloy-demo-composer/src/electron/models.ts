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

import * as explore from "../types";
import { promises as fs } from "fs";
import * as path from "path";
import { RUNTIME } from "./runtime";
import { Runtime, URL } from "@malloydata/malloy";
import { getConfig } from "./config";
import { URL_READER } from "./urls";
import { CONNECTION_MANAGER } from "./connections";

export async function getModels(): Promise<explore.Model[]> {
  const { modelsPath } = await getConfig();
  const files = await fs.readdir(modelsPath);
  const models: explore.Model[] = [];
  for (const file of files) {
    if (file.endsWith(".malloy") && !file.endsWith(".a.malloy")) {
      const fullPath = path.join(modelsPath, file);
      models.push(await getModel(fullPath));
    }
  }
  return models;
}

export async function getModel(fullPath: string): Promise<explore.Model> {
  const content = await fs.readFile(fullPath, "utf8");
  const connections = CONNECTION_MANAGER.getConnectionLookup(
    new URL("file://" + fullPath)
  );
  const runtime = new Runtime(URL_READER, connections);
  const model = await runtime.getModel(new URL("file://" + fullPath));
  const sources = model.exportedExplores.map((explore) => {
    return {
      name: explore.name,
    };
  });
  let dataStyles;
  try {
    const dsRaw = await fs.readFile(
      fullPath.replace(/\.malloy$/, ".styles.json"),
      "utf8"
    );
    dataStyles = JSON.parse(dsRaw);
  } catch (error) {
    dataStyles = {};
  }
  return {
    type: "model",
    path: path.basename(fullPath),
    fullPath,
    malloy: content,
    sources,
    modelDef: model._modelDef,
    dataStyles,
  };
}
