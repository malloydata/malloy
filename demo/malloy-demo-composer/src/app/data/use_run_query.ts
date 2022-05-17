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

import { useMutation } from "react-query";
import { Analysis } from "../../types";
import * as malloy from "@malloydata/malloy";

async function runQuery(query: string, queryName: string, analysis?: Analysis) {
  if (analysis === undefined) {
    return undefined;
  }
  const res = await window.malloy.runQuery(query, queryName, {
    ...analysis,
    modelDef: {},
  });
  return malloy.Result.fromJSON(res);
}

interface UseRunQueryResult {
  result: malloy.Result | undefined;
  runQuery: () => void;
  isRunning: boolean;
  clearResult: () => void;
}

export function useRunQuery(
  query: string,
  queryName: string,
  analysis?: Analysis
): UseRunQueryResult {
  const { data, mutateAsync, isLoading, reset } = useMutation(
    () => runQuery(query, queryName, analysis),
    {}
  );

  const runQueryRet = () => {
    reset();
    mutateAsync();
  };

  return {
    result: data,
    runQuery: runQueryRet,
    isRunning: isLoading,
    clearResult: reset,
  };
}
