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

import {
  FieldDef,
  FilterExpression,
  QueryFieldDef,
  StructDef,
  Result as MalloyResult,
} from "@malloydata/malloy";
import { DataStyles } from "@malloydata/render";
import { useCallback, useRef, useState } from "react";
import { QueryBuilder, QueryWriter } from "../../core/query";
import { Analysis, QuerySummary, RendererName, StagePath } from "../../types";
import { useSaveField, useWatchAnalysis } from "../data";
import { useRunQuery } from "../data/use_run_query";

interface UseQueryBuilderResult {
  queryBuilder: React.MutableRefObject<QueryBuilder | undefined>;
  queryMalloy: string;
  queryName: string;
  clearQuery: (newAnalysis?: Analysis) => void;
  runQuery: () => void;
  isRunning: boolean;
  clearResult: () => void;
  source: StructDef | undefined;
  queryModifiers: QueryModifiers;
  querySummary: QuerySummary | undefined;
  result: MalloyResult | undefined;
  dataStyles: DataStyles;
}

interface UseQueryBuilderProps {
  analysis: Analysis | undefined;
  setAnalysis: (anaysis: Analysis | undefined) => void;
  openDirectory: string | undefined;
}

export interface QueryModifiers {
  addFilter: (
    stagePath: StagePath,
    filter: FilterExpression,
    as?: string
  ) => void;
  toggleField: (stagePath: StagePath, fieldPath: string) => void;
  addLimit: (stagePath: StagePath, limit: number) => void;
  addOrderBy: (
    stagePath: StagePath,
    byFieldIndex: number,
    direction?: "asc" | "desc"
  ) => void;
  addNewNestedQuery: (stagePath: StagePath, name: string) => void;
  addNewDimension: (stagePath: StagePath, dimension: QueryFieldDef) => void;
  addNewMeasure: (stagePath: StagePath, measure: QueryFieldDef) => void;
  setDataStyle: (name: string, renderer: RendererName | undefined) => void;
  addStage: (stagePath: StagePath | undefined, fieldIndex?: number) => void;
  loadQuery: (queryPath: string) => void;
  updateFieldOrder: (stagePath: StagePath, newOrdering: number[]) => void;
  removeField: (stagePath: StagePath, fieldIndex: number) => void;
  removeFilter: (
    stagePath: StagePath,
    filterIndex: number,
    fieldIndex?: number
  ) => void;
  removeLimit: (stagePath: StagePath) => void;
  removeOrderBy: (stagePath: StagePath, orderByIndex: number) => void;
  renameField: (
    stagePath: StagePath,
    fieldIndex: number,
    newName: string
  ) => void;
  addFilterToField: (
    stagePath: StagePath,
    fieldIndex: number,
    filter: FilterExpression,
    as?: string
  ) => void;
  editLimit: (stagePath: StagePath, limit: number) => void;
  editFilter: (
    stagePath: StagePath,
    fieldIndex: number | undefined,
    filterIndex: number,
    filter: FilterExpression
  ) => void;
  replaceWithDefinition: (stagePath: StagePath, fieldIndex: number) => void;
  editDimension: (
    stagePath: StagePath,
    fieldIndex: number,
    dimension: QueryFieldDef
  ) => void;
  editMeasure: (
    stagePath: StagePath,
    fieldIndex: number,
    measure: QueryFieldDef
  ) => void;
  editOrderBy: (
    stagePath: StagePath,
    orderByIndex: number,
    direction: "asc" | "desc" | undefined
  ) => void;
  removeStage: (stagePath: StagePath) => void;
  saveDimension: (
    stagePath: StagePath,
    fieldIndex: number,
    name: string,
    definition: FieldDef
  ) => void;
  saveMeasure: (
    stagePath: StagePath,
    fieldIndex: number,
    name: string,
    definition: FieldDef
  ) => void;
  saveNestQuery: (
    stagePath: StagePath,
    fieldIndex: number,
    name: string,
    definition: FieldDef
  ) => void;
  saveCurrentQuery: (name: string) => void;
  clearQuery: () => void;
  onDrill: (filters: FilterExpression[]) => void;
  loadQueryInNewAnalysis: (newAnalysis: Analysis, queryName: string) => void;
}

export function useQueryBuilder({
  analysis,
  setAnalysis,
  openDirectory,
}: UseQueryBuilderProps): UseQueryBuilderResult {
  const queryBuilder = useRef<QueryBuilder>();
  const [queryMalloy, setQueryMalloy] = useState<string>("");
  const [querySummary, setQuerySummary] = useState<QuerySummary>();
  const [queryName, setQueryName] = useState("");

  const {
    result,
    runQuery: runQueryRaw,
    isRunning,
    clearResult,
  } = useRunQuery(queryMalloy, queryName, analysis);
  const [dataStyles, setDataStyles] = useState<DataStyles>({});

  const { saveField } = useSaveField(openDirectory, analysis, (newAnalysis) => {
    setAnalysis(newAnalysis);
    withAnalysisSource(newAnalysis, (source) => {
      queryBuilder.current?.updateSource(source);
    });
  });

  const runQuery = () => {
    runQueryRaw();
    const topLevel = {
      stageIndex: querySummary ? querySummary.stages.length - 1 : 0,
    };
    if (!queryBuilder.current?.hasLimit(topLevel)) {
      // TODO magic number here: we run the query before we set this limit,
      //      and this limit just happens to be the default limit
      addLimit(topLevel, 10);
    }
  };

  useWatchAnalysis(analysis, (newAnalysis) => {
    setAnalysis(newAnalysis);
    withAnalysisSource(newAnalysis, (source) => {
      queryBuilder.current?.updateSource(source);
    });
  });

  const loadQueryInNewAnalysis = (newAnalysis: Analysis, queryName: string) => {
    setAnalysis(newAnalysis);
    clearQuery(newAnalysis);
    withAnalysisSource(newAnalysis, (source) => {
      queryBuilder.current?.updateSource(source);
      console.log("fooooo");
      queryBuilder.current?.loadQuery(queryName);
      writeQuery(dataStyles, newAnalysis);
    });
  };

  const writeQuery = (newDataStyles = dataStyles, newAnalysis = analysis) => {
    if (!queryBuilder.current) {
      return;
    }
    const query = queryBuilder.current.getQuery();
    setQueryName(query.name);
    // eslint-disable-next-line no-console
    console.log(query);
    if (!newAnalysis) {
      return;
    }
    withAnalysisSource(newAnalysis, (source) => {
      const writer = new QueryWriter(query, source);
      if (queryBuilder.current?.canRun()) {
        const queryString = writer.getQueryStringForModel();
        setQueryMalloy(queryString);
        // eslint-disable-next-line no-console
        console.log(queryString);
      } else {
        setQueryMalloy("");
      }
      const summary = writer.getQuerySummary(
        analysis?.dataStyles || {},
        newDataStyles
      );
      setQuerySummary(summary);
    });
  };

  const toggleField = (stagePath: StagePath, fieldPath: string) => {
    queryBuilder.current?.toggleField(stagePath, fieldPath);
    writeQuery();
  };

  const removeField = (stagePath: StagePath, fieldIndex: number) => {
    queryBuilder.current?.removeField(stagePath, fieldIndex);
    writeQuery();
  };

  const addFilter = (stagePath: StagePath, filter: FilterExpression) => {
    queryBuilder.current?.addFilter(stagePath, filter);
    writeQuery();
  };

  const editFilter = (
    stagePath: StagePath,
    fieldIndex: number | undefined,
    filterIndex: number,
    filter: FilterExpression
  ) => {
    queryBuilder.current?.editFilter(
      stagePath,
      fieldIndex,
      filterIndex,
      filter
    );
    writeQuery();
  };

  const removeFilter = (
    stagePath: StagePath,
    filterIndex: number,
    fieldIndex?: number
  ) => {
    queryBuilder.current?.removeFilter(stagePath, filterIndex, fieldIndex);
    writeQuery();
  };

  const addLimit = (stagePath: StagePath, limit: number) => {
    queryBuilder.current?.addLimit(stagePath, limit);
    writeQuery();
  };

  const addStage = (stagePath: StagePath | undefined, fieldIndex?: number) => {
    queryBuilder.current?.addStage(stagePath, fieldIndex);
    writeQuery();
  };

  const removeStage = (stagePath: StagePath) => {
    queryBuilder.current?.removeStage(stagePath);
    writeQuery();
  };

  const addOrderBy = (
    stagePath: StagePath,
    byFieldIndex: number,
    direction?: "asc" | "desc"
  ) => {
    queryBuilder.current?.addOrderBy(stagePath, byFieldIndex, direction);
    writeQuery();
  };

  const editOrderBy = (
    stagePath: StagePath,
    orderByIndex: number,
    direction: "asc" | "desc" | undefined
  ) => {
    queryBuilder.current?.editOrderBy(stagePath, orderByIndex, direction);
    writeQuery();
  };

  const removeOrderBy = (stagePath: StagePath, orderByIndex: number) => {
    queryBuilder.current?.removeOrderBy(stagePath, orderByIndex);
    writeQuery();
  };

  const removeLimit = (stagePath: StagePath) => {
    queryBuilder.current?.removeLimit(stagePath);
    writeQuery();
  };

  const renameField = (
    stagePath: StagePath,
    fieldIndex: number,
    newName: string
  ) => {
    queryBuilder.current?.renameField(stagePath, fieldIndex, newName);
    writeQuery();
  };

  const addFilterToField = (
    stagePath: StagePath,
    fieldIndex: number,
    filter: FilterExpression,
    as?: string
  ) => {
    queryBuilder.current?.addFilterToField(stagePath, fieldIndex, filter, as);
    writeQuery();
  };

  const addNewNestedQuery = (stagePath: StagePath, name: string) => {
    queryBuilder.current?.addNewNestedQuery(stagePath, name);
    writeQuery();
  };

  const addNewDimension = (stagePath: StagePath, dimension: QueryFieldDef) => {
    queryBuilder.current?.addNewField(stagePath, dimension);
    writeQuery();
  };

  const editDimension = (
    stagePath: StagePath,
    fieldIndex: number,
    dimension: QueryFieldDef
  ) => {
    queryBuilder.current?.editFieldDefinition(stagePath, fieldIndex, dimension);
    writeQuery();
  };

  const editMeasure = (
    stagePath: StagePath,
    fieldIndex: number,
    measure: QueryFieldDef
  ) => {
    queryBuilder.current?.editFieldDefinition(stagePath, fieldIndex, measure);
    writeQuery();
  };

  const updateFieldOrder = (stagePath: StagePath, order: number[]) => {
    queryBuilder.current?.reorderFields(stagePath, order);
    writeQuery();
  };

  const replaceWithDefinition = (stagePath: StagePath, fieldIndex: number) => {
    if (analysis === undefined) {
      return;
    }
    const struct = analysis.modelDef.contents[analysis.sourceName];
    if (struct.type !== "struct") {
      return;
    }
    analysis &&
      queryBuilder.current?.replaceWithDefinition(
        stagePath,
        fieldIndex,
        struct
      );
    writeQuery();
  };

  const loadQuery = (queryPath: string) => {
    queryBuilder.current?.loadQuery(queryPath);
    writeQuery();
  };

  const addNewMeasure = addNewDimension;

  const saveCurrentQuery = useCallback(
    (name: string) => {
      const query = queryBuilder.current?.getQuery();
      if (query) {
        saveField("query", name, query);
      }
    },
    [saveField]
  );

  const saveAnyField = useCallback(
    (
      kind: "dimension" | "measure" | "query",
      stagePath: StagePath,
      fieldIndex: number,
      name: string,
      fieldDef: FieldDef
    ) => {
      saveField(kind, name, fieldDef).then((analysis) => {
        if (analysis) {
          withAnalysisSource(analysis, (source) => {
            queryBuilder.current?.updateSource(source);
          });
          queryBuilder.current?.replaceSavedField(stagePath, fieldIndex, name);
          writeQuery(dataStyles, analysis);
        }
      });
    },
    [saveField]
  );

  const saveDimension = useCallback(
    (
      stagePath: StagePath,
      fieldIndex: number,
      name: string,
      fieldDef: FieldDef
    ) => {
      saveAnyField("dimension", stagePath, fieldIndex, name, fieldDef);
    },
    [saveAnyField]
  );

  const saveMeasure = useCallback(
    (
      stagePath: StagePath,
      fieldIndex: number,
      name: string,
      fieldDef: FieldDef
    ) => {
      saveAnyField("measure", stagePath, fieldIndex, name, fieldDef);
    },
    [saveAnyField]
  );

  const saveNestQuery = useCallback(
    (
      stagePath: StagePath,
      fieldIndex: number,
      name: string,
      fieldDef: FieldDef
    ) => {
      saveAnyField("query", stagePath, fieldIndex, name, fieldDef);
    },
    [saveAnyField]
  );

  const clearQuery = (newAnalysis = analysis) => {
    setDataStyle(queryName, undefined);
    setQueryMalloy("");
    if (newAnalysis) {
      const source = newAnalysis.modelDef.contents[newAnalysis.sourceName];
      if (source.type !== "struct") {
        throw new Error("Source for analysis must be a source, not a query");
      }
      queryBuilder.current = new QueryBuilder(source);
      setQuerySummary({
        stages: [{ items: [], orderByFields: [], inputSource: source }],
      });
    }
    clearResult();
    writeQuery();
  };

  const sourceRaw = analysis && analysis.modelDef.contents[analysis.sourceName];
  const source = sourceRaw?.type === "struct" ? sourceRaw : undefined;

  const onDrill = (filters: FilterExpression[]) => {
    if (!source) {
      return;
    }
    queryBuilder.current = new QueryBuilder(source);
    for (const filter of filters) {
      queryBuilder.current.addFilter({ stageIndex: 0 }, filter);
    }
    writeQuery();
  };

  const setDataStyle = (name: string, renderer: RendererName | undefined) => {
    const newDataStyles = { ...dataStyles };
    if (renderer === undefined) {
      if (name in newDataStyles) {
        delete newDataStyles[name];
      }
    } else {
      newDataStyles[name] = { renderer };
    }
    setDataStyles(newDataStyles);
    writeQuery(newDataStyles);
  };

  return {
    queryBuilder,
    queryMalloy,
    queryName,
    clearQuery,
    runQuery,
    isRunning,
    clearResult,
    source,
    querySummary,
    dataStyles,
    result,
    queryModifiers: {
      addFilter,
      toggleField,
      addLimit,
      addOrderBy,
      addNewNestedQuery,
      addNewDimension,
      addNewMeasure,
      setDataStyle,
      addStage,
      loadQuery,
      updateFieldOrder,
      removeField,
      removeFilter,
      removeLimit,
      removeOrderBy,
      renameField,
      addFilterToField,
      editLimit: addLimit,
      editFilter,
      replaceWithDefinition,
      editDimension,
      editMeasure,
      editOrderBy,
      removeStage,
      saveDimension,
      saveMeasure,
      saveNestQuery,
      saveCurrentQuery,
      clearQuery,
      onDrill,
      loadQueryInNewAnalysis,
    },
  };
}

function withAnalysisSource(
  analysis: Analysis,
  callback: (source: StructDef) => void
) {
  const source = analysis.modelDef.contents[analysis.sourceName];
  if (source && source.type === "struct") {
    callback(source);
  }
}
