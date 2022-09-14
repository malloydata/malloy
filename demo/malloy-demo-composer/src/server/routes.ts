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

import { FieldDef, StructDef } from "@malloydata/malloy";
import express from "express";
import { Analysis } from "../types";
import { getAnalysis, readMalloyDirectory } from "./directory";
import { wrapErrors } from "./errors";
import { getModels } from "./models";
import { runQuery } from "./run_query";
import { saveField } from "./save_query";
import { getSchema } from "./schema";
import { searchIndex } from "./search";
import { topValues } from "./top_values";

export function routes(router: express.Router): void {
  router.get("/models", async (_, res: express.Response) => {
    res.json(await wrapErrors(async () => ({ models: await getModels() })));
  });

  router.get("/analyses", async (_, res: express.Response) => {
    res.json(
      await wrapErrors(async () => ({ directory: await readMalloyDirectory() }))
    );
  });

  router.get(
    "/analysis",
    async (req: express.Request, res: express.Response) => {
      const analysisPath = req.query.path as string;
      res.json(
        await wrapErrors(async () => ({
          analysis: await getAnalysis(analysisPath),
        }))
      );
    }
  );

  router.get("/schema", async (req: express.Request, res: express.Response) => {
    const analysableRef = req.query as unknown as Analysis;
    res.json(await wrapErrors(async () => await getSchema(analysableRef)));
  });

  router.post(
    "/run_query",
    async (req: express.Request, res: express.Response) => {
      const query = req.body.query as string;
      const queryName = req.body.queryName as string;
      const analysis = req.body.analysis as unknown as Analysis;
      res.json(
        await wrapErrors(async () => {
          const result = await runQuery(query, queryName, analysis);
          return { result: result.toJSON() };
        })
      );
    }
  );

  router.post(
    "/save_field",
    async (req: express.Request, res: express.Response) => {
      const field = req.body.field as FieldDef;
      const name = req.body.name as string;
      const analysis = req.body.analysis as Analysis;
      const type = req.body.type as "query" | "dimension" | "measure";
      res.json(
        await wrapErrors(async () => {
          const newAnalysis = await saveField(type, field, name, analysis);
          return { analysis: newAnalysis };
        })
      );
    }
  );

  router.post(
    "/search",
    async (req: express.Request, res: express.Response) => {
      const source = req.body.source as unknown as StructDef;
      const searchTerm = req.body.searchTerm;
      const fieldPath = req.body.fieldPath;
      const analysisPath = req.body.analysisPath;
      res.json(
        await wrapErrors(async () => {
          const result = await searchIndex(
            source,
            analysisPath,
            searchTerm,
            fieldPath
          );
          return { result: result };
        })
      );
    }
  );

  router.post(
    "/top_values",
    async (req: express.Request, res: express.Response) => {
      const source = req.body.source as unknown as StructDef;
      const analysisPath = req.body.analysisPath as string;
      res.json(
        await wrapErrors(async () => {
          const result = await topValues(source, analysisPath);
          return { result: result };
        })
      );
    }
  );
}
