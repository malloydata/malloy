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

import { useQuery } from "react-query";
import * as explore from "../../types";
import { isElectron } from "../utils";

export const KEY = (path: string | undefined): string => `directory/${path}`;

export function useDirectory(
  path: string | undefined
): explore.Directory | undefined {
  const { data: directory } = useQuery(
    KEY(path),
    async () => {
      if (isElectron()) {
        return window.malloy.analyses(path);
      }
      const raw = await (await fetch("api/analyses")).json();
      return raw.directory as explore.Directory;
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  return directory;
}
