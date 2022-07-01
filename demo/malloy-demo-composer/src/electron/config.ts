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

import { promises as fs } from "fs";
import { existsSync } from "fs";
import * as path from "path";
import * as os from "os";

interface ComposerConfig {
  modelsPath: string;
}

export async function getConfig(): Promise<ComposerConfig> {
  let config = {
    modelsPath: path.join(__dirname, "../../../samples"),
  };
  const configFilePath = path.resolve("./composer_config.json");
  if (existsSync(configFilePath)) {
    try {
      const file = await fs.readFile(configFilePath, "utf8");
      const fileConfig = JSON.parse(file);
      config = { ...config, ...fileConfig };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(error);
    }
  }

  if (config.modelsPath.startsWith("~")) {
    config.modelsPath = config.modelsPath.replace(/^~/, os.homedir());
  }

  config.modelsPath = path.resolve(config.modelsPath);

  return config;
}
