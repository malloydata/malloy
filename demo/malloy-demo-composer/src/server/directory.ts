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
import { URLReader, Runtime } from "@malloydata/malloy";
import { CONNECTION_MANAGER } from "./connections";
import { URL_READER } from "./urls";
import { getModel } from "./models";
import { getConfig } from "./config";
import { fileURLToPath } from "url";

class FirstImportCapturingURLReader implements URLReader {
  private firstImport: string | undefined = undefined;

  readURL(url: URL) {
    let path = url.toString();
    if (url.protocol == "file:") {
      path = fileURLToPath(url);
    }
    if (this.firstImport === undefined) {
      this.firstImport = path;
    }
    return URL_READER.readURL(url);
  }

  startCapture() {
    this.firstImport = undefined;
  }

  stopCapture(): string {
    if (this.firstImport === undefined) {
      throw new Error("stopCapture called before any import");
    }
    return this.firstImport;
  }
}

export async function getAnalysis(fullPath: string): Promise<explore.Analysis> {
  const urls = new FirstImportCapturingURLReader();
  const content = await fs.readFile(fullPath, "utf8");
  urls.startCapture();
  const connections = CONNECTION_MANAGER.getConnectionLookup(
    new URL("file://" + fullPath)
  );
  const model = await new Runtime(urls, connections).getModel(content);
  const modelFullPath = urls.stopCapture();
  let modelDataStyles;
  try {
    const dsRaw = await fs.readFile(
      modelFullPath.replace(/\.malloy$/, ".styles.json"),
      "utf8"
    );
    modelDataStyles = JSON.parse(dsRaw);
  } catch (error) {
    modelDataStyles = {};
  }
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
    type: "analysis",
    path: path.basename(fullPath),
    modelFullPath,
    fullPath,
    malloy: content,
    sourceName: model.explores[model.explores.length - 1].name,
    modelDef: model._modelDef,
    dataStyles: { ...modelDataStyles, ...dataStyles },
  };
}

export async function getAnalyses(): Promise<explore.Analysis[]> {
  const { modelsPath } = await getConfig();
  const files = await fs.readdir(modelsPath);
  const analyses: explore.Analysis[] = [];
  for (const file of files) {
    if (file.endsWith(".a.malloy")) {
      analyses.push(await getAnalysis(path.join(modelsPath, file)));
    }
  }
  return analyses;
}

export async function readMalloyDirectory(
  thePath?: string
): Promise<explore.Directory> {
  if (thePath === undefined) {
    const { modelsPath } = await getConfig();
    thePath = modelsPath;
  }
  const directory = {
    path: path.basename(thePath),
    fullPath: thePath,
    type: "directory",
    contents: [],
  } as explore.Directory;
  await Promise.all(
    (
      await fs.readdir(thePath)
    ).map(async (childPath) => {
      if (childPath.startsWith(".")) {
        return;
      }
      let fullChildPath = path.join(thePath || "/", childPath);
      try {
        let stat = await fs.lstat(fullChildPath);
        let symlinkMax = 10;
        while (stat.isSymbolicLink()) {
          fullChildPath = await fs.realpath(fullChildPath);
          stat = await fs.lstat(fullChildPath);
          if (symlinkMax <= 0) {
            // eslint-disable-next-line no-console
            console.log("Error: reached maximum symlink depth");
            break;
          }
          symlinkMax--;
        }
        if (stat.isSymbolicLink()) {
          return;
        }
        if (stat.isDirectory()) {
          directory.contents.push(await readMalloyDirectory(fullChildPath));
        } else if (childPath.endsWith(".a.malloy")) {
          directory.contents.push(await getAnalysis(fullChildPath));
        } else if (childPath.endsWith(".malloy")) {
          directory.contents.push(await getModel(fullChildPath));
        } else if (childPath.toLowerCase() === "readme.md") {
          directory.readme = await fs.readFile(fullChildPath, "utf8");
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log(error);
      }
    })
  );
  return directory;
}
