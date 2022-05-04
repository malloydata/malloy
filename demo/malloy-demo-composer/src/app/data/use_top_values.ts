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

import { SearchValueMapResult } from "@malloydata/malloy";
import { useQuery } from "react-query";
import { Analysis } from "../../types";
import { API } from "./api";

export function KEY(analysis?: Analysis): string {
  return analysis
    ? analysis.fullPath
      ? `top_values/analysis/${analysis.fullPath}`
      : `top_values/model/${analysis.modelFullPath}/source/${analysis.sourceName}`
    : `top_values/undefined`;
}

async function fetchTopValues(
  analysis?: Analysis
): Promise<SearchValueMapResult[] | undefined> {
  if (analysis === undefined) {
    return undefined;
  }
  const source = analysis && analysis.modelDef.contents[analysis.sourceName];
  const raw = await (
    await fetch(`${API}/top_values`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source }),
    })
  ).json();
  return raw.result as SearchValueMapResult[];
}

export function useTopValues(
  analysis?: Analysis
): SearchValueMapResult[] | undefined {
  const { data: models } = useQuery(
    KEY(analysis),
    () => fetchTopValues(analysis),
    {
      refetchOnWindowFocus: false,
    }
  );

  return models;
}
