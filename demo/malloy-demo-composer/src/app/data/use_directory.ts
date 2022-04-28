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
import { API } from "./api";

export const KEY = "directory";

async function fetchDirectory(): Promise<explore.Directory> {
  const raw = await (await fetch(`${API}/analyses`)).json();
  return raw.directory as explore.Directory;
}

export function useDirectory(): explore.Directory | undefined {
  const { data: directory } = useQuery(KEY, fetchDirectory, {
    refetchOnWindowFocus: false,
  });

  return directory;
}
