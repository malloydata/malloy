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

export function KEY(analysis?: explore.Analysis): string {
  return analysis
    ? analysis.type === "analysis"
      ? `schema/analysis/${analysis.fullPath}`
      : `schema/model/${analysis.fullPath}/source/${analysis.sourceName}`
    : `schema/undefined`;
}

async function fetchSchema(
  analysis: explore.Analysis | undefined,
  setAnalysis: (analysis: explore.Analysis) => void
): Promise<explore.Schema | undefined> {
  if (analysis === undefined) {
    return undefined;
  }
  const params: Record<string, string> = {
    malloy: analysis.malloy,
    modelFullPath: analysis.modelFullPath,
    sourceName: analysis.sourceName,
  };
  if (analysis.fullPath) {
    params.fullPath = analysis.fullPath;
  }
  if (analysis.path) {
    params.path = analysis.path;
  }
  const schema = await window.malloy.schema(params);
  analysis.modelDef = schema.modelDef;
  analysis.malloy = schema.malloy;
  setAnalysis(analysis);
  return schema.schema as explore.Schema;
}

export function useSchema(
  analysis: explore.Analysis | undefined,
  setAnalysis: (analysis: explore.Analysis) => void
): explore.Schema | undefined {
  const { data: schema } = useQuery(
    KEY(analysis),
    () => fetchSchema(analysis, setAnalysis),
    {
      refetchOnWindowFocus: true,
    }
  );

  return schema;
}
