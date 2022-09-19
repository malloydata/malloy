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

import { useMutation, useQueryClient } from "react-query";
import { Analysis } from "../../types";
import { KEY as DIRECTORY_KEY } from "./use_directory";
import { FieldDef, ModelDef, Result } from "@malloydata/malloy";
import { isElectron } from "../utils";

async function saveField(
  type: "query" | "dimension" | "measure",
  field: FieldDef,
  name: string,
  analysis?: Analysis
) {
  if (analysis === undefined) {
    return undefined;
  }
  if (isElectron()) {
    const res = await window.malloy.saveField(type, field, name, {
      ...analysis,
      modelDef: {} as unknown as ModelDef,
    });
    if (res instanceof Error) {
      throw res;
    }
    return res;
  }

  const raw = await(
    await fetch("api/save_field", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        field,
        name,
        analysis: { ...analysis, modelDef: {} },
      }),
    })
  ).json();
  return raw.analysis as Analysis;
}

interface UseSaveFieldResult {
  result: Analysis | undefined;
  saveField: (
    type: "query" | "dimension" | "measure",
    name: string,
    field: FieldDef
  ) => Promise<Analysis | undefined>;
  isSaving: boolean;
}

export function useSaveField(
  directoryPath: string | undefined,
  analysis: Analysis | undefined,
  setAnalysis: (analysis: Analysis) => void
): UseSaveFieldResult {
  const queryClient = useQueryClient();
  const { data, mutateAsync, isLoading, reset } = useMutation(
    ({
      name,
      field,
      type,
    }: {
      name: string;
      field: FieldDef;
      type: "query" | "dimension" | "measure";
    }) => saveField(type, field, name, analysis),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(DIRECTORY_KEY(directoryPath));
      },
    }
  );

  const saveFieldRet = async (
    type: "query" | "dimension" | "measure",
    name: string,
    field: FieldDef
  ) => {
    reset();
    const analysis = await mutateAsync({ name, type, field });
    if (analysis) {
      setAnalysis(analysis);
    }
    return analysis;
  };

  return { result: data, saveField: saveFieldRet, isSaving: isLoading };
}
