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

import { QueryWriter } from "../core/query";
import { Analysis } from "../types";
import { promises as fs } from "fs";
import { RUNTIME } from "./runtime";
import { FieldDef, Field } from "@malloydata/malloy";

function codeBefore(code: string, location: { line: number, character: number }) {
  const lines = code.split("\n");
  const wellBefore = lines.slice(0, location.line);
  const before = lines[location.line].substring(0, location.character);
  return wellBefore.join("\n") + "\n" + before;
}

function codeAfter(code: string, location: { line: number, character: number }) {
  const lines = code.split("\n");
  const wellAfter = lines.slice(location.line + 1);
  const after = lines[location.line].substring(location.character);
  return after + "\n" + wellAfter.join("\n");
}

function indent(str: string) {
  return str.split("\n").map((line) => "  " + line).join("\n");
}

function indentExceptFirstLine(str: string) {
  const lines = str.split("\n");
  return lines[0] + "\n" + lines.slice(1).map((line) => "  " + line).join("\n");
}

export async function saveField(type: "query" | "dimension" | "measure", field: FieldDef, name: string, analysis: Analysis) {
  const model = await RUNTIME.getModel(analysis.malloy);
  const source = model._modelDef.contents[analysis.sourceName];
  if (source.type !== "struct") {
    throw new Error("Wrong type for source.");
  }
  if (field.type === "struct") {
    throw new Error("Invalid field to save");
  }
  const fieldString = field.type === "turtle"
    ? new QueryWriter(field, source).getQueryStringForSource(name)
    : field.code;
  if (fieldString === undefined) {
    throw new Error("Expected field to have code.");
  }
  const explore = model.getExploreByName(analysis.sourceName);
  const existingField = explore.allFields.find((field) => field.name === name);
  let newMalloy;
  if (existingField) {
    const existingLocation = locationOf(existingField);
    if (existingLocation.url === `internal://internal.malloy`) {
      newMalloy = codeBefore(analysis.malloy, existingLocation.range.start)
        + indentExceptFirstLine(fieldString)
        + codeAfter(analysis.malloy, existingLocation.range.end);
    } else {
      newMalloy = analysis.malloy.replace(/\}\s*$/, "\n" + indent(`${type}: ${fieldString}`) + "\n}");
    }
  } else {
    newMalloy = analysis.malloy.replace(/\}\s*$/, "\n" + indent(`${type}: ${fieldString}`) + "\n}");
  }
  if (analysis.fullPath) {
    await fs.writeFile(analysis.fullPath, newMalloy);
  }
  const newModel = await RUNTIME.getModel(newMalloy);
  return {
    ...analysis,
    malloy: newMalloy,
    modelDef: newModel._modelDef
  }
}

function locationOf(existingField: Field) {
  if (existingField.isQueryField()) {
    return (existingField as any).turtleDef.location;
  } else if (existingField.isAtomicField()) {
    return (existingField as any).fieldTypeDef.location;
  }
}