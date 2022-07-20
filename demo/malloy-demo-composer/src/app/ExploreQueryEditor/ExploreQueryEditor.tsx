import {
  FilterExpression,
  SearchValueMapResult,
  StructDef,
  Result as MalloyResult,
} from "@malloydata/malloy";
import { DataStyles } from "@malloydata/render";
import { useState } from "react";
import styled from "styled-components";
import { Analysis, QuerySummary, StagePath } from "../../types";
import { ActionIcon } from "../ActionIcon";
import { EmptyMessage, PanelTitle } from "../CommonElements";
import { QueryModifiers } from "../hooks/use_query_builder";
import { Popover } from "../Popover";
import { QuerySummaryPanel } from "../QuerySummaryPanel";
import { Result } from "../Result";
import { SaveQueryButton } from "../SaveQueryButton";
import { TopQueryActionMenu } from "../TopQueryActionMenu";

interface ExploreQueryEditorProps {
  source: StructDef | undefined;
  analysis: Analysis | undefined;
  topValues: SearchValueMapResult[] | undefined;
  queryName: string;
  querySummary: QuerySummary | undefined;
  result: MalloyResult | undefined;
  dataStyles: DataStyles;
  queryMalloy: string;
  isRunning: boolean;
  queryModifiers: QueryModifiers;
}

export const ExploreQueryEditor: React.FC<ExploreQueryEditorProps> = ({
  source,
  analysis,
  queryName,
  topValues,
  querySummary,
  result,
  dataStyles,
  isRunning,
  queryMalloy,
  queryModifiers,
}) => {
  const [insertOpen, setInsertOpen] = useState(false);
  return (
    <>
      <SidebarOuter>
        <PanelTitle>
          Query
          {source && analysis && (
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
                  queryModifiers={queryModifiers}
                  stagePath={{ stageIndex: 0 }}
                  orderByFields={querySummary?.stages[0].orderByFields || []}
                  closeMenu={() => setInsertOpen(false)}
                  queryName={queryName}
                  stageSummary={querySummary?.stages[0].items || []}
                  isOnlyStage={querySummary?.stages.length === 1}
                  topValues={topValues}
                />
              </Popover>
              <SaveQueryButton saveQuery={queryModifiers.saveCurrentQuery} />
              <ActionIcon
                action="remove"
                onClick={() => queryModifiers.clearQuery()}
                color="dimension"
              />
            </QueryButtons>
          )}
        </PanelTitle>
        <QueryBar>
          <QueryBarInner>
            {source && querySummary && analysis && (
              <QuerySummaryPanel
                analysisPath={analysis.fullPath || analysis.modelFullPath}
                source={source}
                querySummary={querySummary}
                queryModifiers={queryModifiers}
                stagePath={undefined}
                queryName={queryName}
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
            onDrill={queryModifiers.onDrill}
          />
        )}
      </ScrollContent>
    </>
  );
};

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

const QueryButtons = styled.div`
  display: flex;
  gap: 5px;
`;

const Content = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
`;

const ScrollContent = styled(Content)`
  overflow-y: auto;
`;
