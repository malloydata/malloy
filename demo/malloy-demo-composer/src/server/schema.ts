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

import { Runtime, ModelDef, Field } from "@malloydata/malloy";
import * as explore from "../types";
import { promises as fs } from "fs";
import { CONNECTION_MANAGER } from "./connections";
import { URL_READER } from "./urls";

export async function getSchema(analysis: explore.Analysis): Promise<{
  schema: explore.Schema;
  modelDef: ModelDef;
  malloy: string;
}> {
  const malloy = analysis.fullPath
    ? await fs.readFile(analysis.fullPath, "utf8")
    : analysis.malloy;
  const connections = CONNECTION_MANAGER.getConnectionLookup(
    new URL("file://" + analysis.fullPath)
  );
  const runtime = new Runtime(URL_READER, connections);
  const model = await runtime.getModel(malloy);
  const source = model.explores.find(
    (source) => source.name === analysis.sourceName
  );
  if (source === undefined) {
    throw new Error(
      `Invalid analysis: no source with name ${analysis.sourceName}`
    );
  }
  return {
    schema: {
      fields: source.allFields.map((field) => mapField(field, undefined)),
    },
    modelDef: model._modelDef,
    malloy: malloy,
  };
}

function mapField(field: Field, path: string | undefined): explore.SchemaField {
  const newPath = path !== undefined ? `${path}.${field.name}` : field.name;
  if (field.isExploreField()) {
    return {
      name: field.name,
      path: newPath,
      type: "source",
      kind: "source",
      fields: field.allFields.map((field) => mapField(field, newPath)),
    };
  } else if (field.isQueryField()) {
    return {
      name: field.name,
      path: newPath,
      type: "query",
      kind: "query",
    };
  } else {
    const kind = field.isAggregate() ? "measure" : "dimension";
    return {
      name: field.name,
      path: newPath,
      type: field.type,
      kind,
    };
  }
}
