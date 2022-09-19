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

import { useEffect } from "react";
import { useQuery } from "react-query";
import * as explore from "../../types";
import { isElectron } from "../utils";

export const KEY = "currentAnalysis";

async function refetchAnalysis(
  analysis?: explore.Analysis
): Promise<explore.Analysis | undefined> {
  if (analysis === undefined || analysis.fullPath === undefined) {
    return undefined;
  }
  if (isElectron()) {
    return window.malloy.analysis(analysis.fullPath);
  }

  const params = new URLSearchParams({
    path: analysis.fullPath,
  });
  const raw = await (await fetch(`api/analysis?${params}`)).json();
  return raw.analysis as explore.Analysis;
}

export function useWatchAnalysis(
  analysis: explore.Analysis | undefined,
  setAnalysis: (analysis: explore.Analysis) => void
): void {
  const { data: newAnalysis } = useQuery(KEY, () => refetchAnalysis(analysis), {
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (newAnalysis !== undefined) {
      setAnalysis(newAnalysis);
    }
  }, [newAnalysis]);
}
