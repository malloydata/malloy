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

import { existsSync, promises as fs } from "fs";
import { ProjectInfo } from "../types";
import * as path from "path";

export async function getSampleProjects(): Promise<ProjectInfo[]> {
  const sampleProjectsDirectory = "../../samples";
  console.log(path.resolve(sampleProjectsDirectory));
  const samples: ProjectInfo[] = [];
  await Promise.all(
    (
      await fs.readdir(sampleProjectsDirectory)
    ).map(async (childPath) => {
      const fullChildPath = path.join(sampleProjectsDirectory, childPath);
      const stat = await fs.lstat(fullChildPath);
      if (stat.isDirectory()) {
        const configPath = path.join(fullChildPath, "package.json");
        if (existsSync(configPath)) {
          const configJSON = await fs.readFile(configPath, "utf-8");
          const config = JSON.parse(configJSON);
          samples.push({
            fullPath: fullChildPath,
            iconName: config.icon,
            description: config.description,
            version: config.version,
            name: config.name,
            displayName: config.displayName,
          });
        }
      }
    })
  );
  return samples;
}
