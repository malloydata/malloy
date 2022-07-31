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

import { useRef, useState } from "react";
import { QueryBuilder, QueryWriter } from "../../core/query";
import styled from "styled-components";
import { Analysis, QuerySummary, RendererName, StagePath } from "../../types";
import { useSaveField, useWatchAnalysis } from "../data";
import { useDirectory } from "../data/use_directory";
import { useRunQuery } from "../data/use_run_query";
import { Result } from "../Result";
import { TopQueryActionMenu } from "../TopQueryActionMenu";
import { Button, EmptyMessage, PanelTitle } from "../CommonElements";
import { ErrorMessage } from "../ErrorMessage";
import { Popover } from "../Popover";
import { QuerySummaryPanel } from "../QuerySummaryPanel";
import { MalloyLogo } from "../MalloyLogo";
import { useCallback } from "react";
import { SaveQueryButton } from "../SaveQueryButton";
import { FilterExpression, StructDef } from "@malloydata/malloy";
import { FieldDef, QueryFieldDef } from "@malloydata/malloy";
import { ActionIcon } from "../ActionIcon";
import { DataStyles } from "@malloydata/render";
import { DirectoryPicker } from "../DirectoryPicker";
import { HotKeys } from "react-hotkeys";
import { useTopValues } from "../data/use_top_values";
import { useOpenDirectory } from "../data/use_open_directory";

const KEY_MAP = {
  REMOVE_FIELDS: "command+k",
  RUN_QUERY: "command+enter",
};

function withAnalysisSource(
  analysis: Analysis,
  callback: (source: StructDef) => void
) {
  const source = analysis.modelDef.contents[analysis.sourceName];
  if (source && source.type === "struct") {
    callback(source);
  }
}

export const Explore: React.FC = () => {
  const [analysis, setAnalysis] = useState<Analysis>();
  const { openDirectory, beginOpenDirectory } = useOpenDirectory();
  const directory = useDirectory(openDirectory);
  const queryBuilder = useRef<QueryBuilder>();
  const [queryMalloy, setQueryMalloy] = useState<string>("");
  const [querySummary, setQuerySummary] = useState<QuerySummary>();
  const [queryName, setQueryName] = useState("");
  const [error, setError] = useState<Error>();
  const {
    result,
    runQuery: runQueryRaw,
    isRunning,
    clearResult,
  } = useRunQuery(queryMalloy, queryName, setError, analysis);
  const { saveField } = useSaveField(openDirectory, analysis, (newAnalysis) => {
    setAnalysis(newAnalysis);
    withAnalysisSource(newAnalysis, (source) => {
      queryBuilder.current?.updateSource(source);
    });
  });
  const [insertOpen, setInsertOpen] = useState(false);
  const [dataStyles, setDataStyles] = useState<DataStyles>({});
  const topValues = useTopValues(analysis);

  useWatchAnalysis(analysis, (newAnalysis) => {
    setAnalysis(newAnalysis);
    withAnalysisSource(newAnalysis, (source) => {
      queryBuilder.current?.updateSource(source);
    });
  });

  const selectAnalysis = (analysis: Analysis) => {
    setAnalysis(analysis);
    clearQuery(analysis);
  };

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

  const source = analysis && analysis.modelDef.contents[analysis.sourceName];
  if (source && source?.type !== "struct") {
    return <div>Source for analysis must be a source, not a query</div>;
  }

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

  const handlers = {
    REMOVE_FIELDS: () => clearQuery(),
    RUN_QUERY: runQuery,
  };

  return (
    <Main handlers={handlers} keyMap={KEY_MAP}>
      <Header>
        <HeaderLeft>
          <MalloyLogo />
          <DirectoryPicker
            directory={directory}
            analysis={analysis}
            selectAnalysis={selectAnalysis}
          />
          <ActionIcon
            action="open-directory"
            onClick={beginOpenDirectory}
            color="dimension"
          />
        </HeaderLeft>
        {!isRunning && <Button onClick={() => runQuery()}>Run</Button>}
        {isRunning && (
          <Button onClick={() => clearResult()} color="primary" outline={true}>
            Cancel
          </Button>
        )}
      </Header>
      <Body>
        <Content>
          <SidebarOuter>
            <PanelTitle>
              Query
              {source && (
                <QueryButtons>
                  <ActionIcon
                    action="add"
                    onClick={() => setInsertOpen(true)}
                    color="dimension"
                  />
                  <Popover open={insertOpen} setOpen={setInsertOpen}>
                    <TopQueryActionMenu
                      analysisPath={analysis.fullPath || analysis.modelFullPath}
                      source={source}
                      toggleField={toggleField}
                      addFilter={addFilter}
                      addLimit={addLimit}
                      addOrderBy={addOrderBy}
                      addNewNestedQuery={addNewNestedQuery}
                      stagePath={{ stageIndex: 0 }}
                      orderByFields={
                        querySummary?.stages[0].orderByFields || []
                      }
                      addNewDimension={addNewDimension}
                      addNewMeasure={addNewMeasure}
                      closeMenu={() => setInsertOpen(false)}
                      queryName={queryName}
                      setDataStyle={setDataStyle}
                      addStage={addStage}
                      loadQuery={loadQuery}
                      updateFieldOrder={updateFieldOrder}
                      stageSummary={querySummary?.stages[0].items || []}
                      isOnlyStage={querySummary?.stages.length === 1}
                      topValues={topValues}
                    />
                  </Popover>
                  <SaveQueryButton saveQuery={saveCurrentQuery} />
                  <ActionIcon
                    action="remove"
                    onClick={() => clearQuery()}
                    color="dimension"
                  />
                </QueryButtons>
              )}
            </PanelTitle>
            <QueryBar>
              <QueryBarInner>
                {source && querySummary && (
                  <QuerySummaryPanel
                    analysisPath={analysis.fullPath || analysis.modelFullPath}
                    source={source}
                    querySummary={querySummary}
                    removeField={removeField}
                    removeFilter={removeFilter}
                    removeLimit={removeLimit}
                    removeOrderBy={removeOrderBy}
                    renameField={renameField}
                    addFilterToField={addFilterToField}
                    editLimit={addLimit}
                    toggleField={toggleField}
                    addFilter={addFilter}
                    addLimit={addLimit}
                    addOrderBy={addOrderBy}
                    addNewNestedQuery={addNewNestedQuery}
                    editFilter={editFilter}
                    stagePath={undefined}
                    addNewDimension={addNewDimension}
                    addNewMeasure={addNewMeasure}
                    replaceWithDefinition={replaceWithDefinition}
                    setDataStyle={setDataStyle}
                    addStage={addStage}
                    queryName={queryName}
                    removeStage={removeStage}
                    updateFieldOrder={updateFieldOrder}
                    editDimension={editDimension}
                    editMeasure={editMeasure}
                    editOrderBy={editOrderBy}
                    saveDimension={saveDimension}
                    saveMeasure={saveMeasure}
                    saveNestQuery={saveNestQuery}
                    topValues={topValues}
                  />
                )}
                {!analysis && (
                  <EmptyMessage>Select an analysis to get started</EmptyMessage>
                )}
              </QueryBarInner>
            </QueryBar>
          </SidebarOuter>
          <ScrollContent>
            {analysis && source && (result || isRunning) && (
              <Result
                source={source}
                result={result}
                analysis={analysis}
                dataStyles={dataStyles}
                malloy={queryMalloy}
                onDrill={onDrill}
              />
            )}
            <ErrorMessage error={error} />
          </ScrollContent>
        </Content>
      </Body>
    </Main>
  );
};

const Main = styled(HotKeys)`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  outline: none;
`;

const Body = styled.div`
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
`;

const Content = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
`;

const SidebarOuter = styled.div`
  width: 300px;
  min-width: 300px;
  border-right: 1px solid #efefef;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const QueryBar = styled.div`
  display: flex;
  overflow-y: auto;
  flex-direction: column;
`;

const QueryBarInner = styled.div`
  padding: 10px;
`;

const Header = styled.div`
  height: 40px;
  border-bottom: 1px solid #efefef;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 20px;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const QueryButtons = styled.div`
  display: flex;
  gap: 5px;
`;

const ScrollContent = styled(Content)`
  overflow-y: auto;
`;
