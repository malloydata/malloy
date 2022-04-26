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

import { FilterExpression } from "@malloydata/malloy";
import { ReactElement, useRef } from "react";
import { useState } from "react";
import {
  QuerySummary,
  QuerySummaryItem,
  RendererName,
  StagePath,
  stagePathPush,
  StageSummary,
} from "../../types";
import { FieldButton } from "../FieldButton";
import { ActionIcon } from "../ActionIcon";
import { Popover } from "../Popover";
import { DimensionActionMenu } from "../DimensionActionMenu";
import { AggregateActionMenu } from "../AggregateActionMenu";
import { SavedQueryActionMenu } from "../SavedQueryActionMenu";
import { LimitActionMenu } from "../LimitActionMenu";
import { ListNest } from "../ListNest";
import { NestQueryActionMenu } from "../NestQueryActionMenu";
import styled from "styled-components";
import { FilterActionMenu } from "../FilterActionMenu";
import {
  FieldDef,
  QueryFieldDef,
  SearchValueMapResult,
  StructDef,
} from "@malloydata/malloy";
import { OrderByActionMenu } from "../OrderByActionMenu";
import { EmptyMessage } from "../CommonElements";
import { useEffect } from "react";
import { DataStyleActionMenu } from "../DataStyleActionMenu";
import { VisIcon } from "../VisIcon";
import { StageActionMenu } from "../StageActionMenu";
import { BackPart, CloseIconStyled } from "../FieldButton/FieldButton";
import { ErrorFieldActionMenu } from "../ErrorFieldActionMenu";
import { notUndefined } from "../utils";
import { useClickOutside } from "../hooks";
import { HoverToPopover } from "../HoverToPopover";
import { FieldDetailPanel } from "../FieldDetailPanel";

interface QuerySummaryPanelProps {
  source: StructDef;
  querySummary: QuerySummary;
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
  toggleField: (stagePath: StagePath, fieldPath: string) => void;
  addFilter: (stagePath: StagePath, filter: FilterExpression) => void;
  addLimit: (stagePath: StagePath, limit: number) => void;
  addOrderBy: (
    stagePath: StagePath,
    fieldIndex: number,
    direction?: "asc" | "desc"
  ) => void;
  addNewNestedQuery: (stagePath: StagePath, name: string) => void;
  editFilter: (
    stagePath: StagePath,
    fieldIndex: number | undefined,
    filterIndex: number,
    filter: FilterExpression
  ) => void;
  stagePath: StagePath | undefined;
  addNewDimension: (stagePath: StagePath, dimension: QueryFieldDef) => void;
  addNewMeasure: (stagePath: StagePath, measure: QueryFieldDef) => void;
  replaceWithDefinition: (stagePath: StagePath, fieldIndex: number) => void;
  setDataStyle: (name: string, renderer: RendererName | undefined) => void;
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
  addStage: (stagePath: StagePath, fieldIndex: number) => void;
  removeStage: (stagePath: StagePath) => void;
  updateFieldOrder: (stagePath: StagePath, ordering: number[]) => void;
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
  topValues: SearchValueMapResult[] | undefined;
  queryName: string;
}

export const QuerySummaryPanel: React.FC<QuerySummaryPanelProps> = ({
  querySummary,
  stagePath,
  queryName,
  topValues,
  ...query
}) => {
  if (
    querySummary.stages[0].items.length === 0 &&
    querySummary.stages.length === 1
  ) {
    if (!stagePath || !stagePath.parts || stagePath.parts.length === 0) {
      return (
        <EmptyMessage>
          <div>Add fields to the query</div>
          <div>with the “+” button</div>
        </EmptyMessage>
      );
    }
  }

  return (
    <FieldListDiv>
      {querySummary.stages.map((stage, stageIndex) => {
        const nestStagePath = stagePathPush(stagePath, {
          stageIndex,
          fieldIndex: 0,
        });
        return (
          <div key={"stage/" + stageIndex}>
            {querySummary.stages.length > 1 && (
              <ClickToPopover
                popoverContent={({ closeMenu }) => (
                  <StageActionMenu
                    source={stage.inputSource}
                    toggleField={query.toggleField}
                    addFilter={query.addFilter}
                    addLimit={query.addLimit}
                    addOrderBy={query.addOrderBy}
                    addNewNestedQuery={query.addNewNestedQuery}
                    stagePath={nestStagePath}
                    remove={() => query.removeStage(nestStagePath)}
                    orderByFields={stage.orderByFields}
                    addNewDimension={query.addNewDimension}
                    addNewMeasure={query.addNewMeasure}
                    closeMenu={closeMenu}
                    isLastStage={stageIndex === querySummary.stages.length - 1}
                    setDataStyle={(renderer) =>
                      query.setDataStyle(queryName, renderer)
                    }
                    stageSummary={stage.items}
                    updateFieldOrder={query.updateFieldOrder}
                    topValues={topValues}
                  />
                )}
                content={({ isOpen }) => (
                  <StageButton active={isOpen}>
                    Stage {stageIndex + 1}
                    <BackPart className="back">
                      <CloseIconStyled
                        color="other"
                        width="20px"
                        height="20px"
                        className="close"
                        onClick={() => query.removeStage(nestStagePath)}
                      />
                    </BackPart>
                  </StageButton>
                )}
              />
            )}
            <StageSummaryUI
              stage={stage}
              {...query}
              stagePath={nestStagePath}
              key={"stage/" + stageIndex}
              source={stage.inputSource}
              topValues={topValues}
            />
          </div>
        );
      })}
    </FieldListDiv>
  );
};

interface SummaryStageProps {
  stage: StageSummary;
  stagePath: StagePath;
  source: StructDef;
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
  toggleField: (stagePath: StagePath, fieldPath: string) => void;
  addFilter: (stagePath: StagePath, filter: FilterExpression) => void;
  addLimit: (stagePath: StagePath, limit: number) => void;
  addOrderBy: (
    stagePath: StagePath,
    fieldIndex: number,
    direction?: "asc" | "desc"
  ) => void;
  addNewNestedQuery: (stagePath: StagePath, name: string) => void;
  editFilter: (
    stagePath: StagePath,
    fieldIndex: number | undefined,
    filterIndex: number,
    filter: FilterExpression
  ) => void;
  addNewDimension: (stagePath: StagePath, dimension: QueryFieldDef) => void;
  addNewMeasure: (stagePath: StagePath, measure: QueryFieldDef) => void;
  replaceWithDefinition: (stagePath: StagePath, fieldIndex: number) => void;
  setDataStyle: (name: string, renderer: RendererName | undefined) => void;
  addStage: (stagePath: StagePath, fieldIndex: number) => void;
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
  updateFieldOrder: (stagePath: StagePath, ordering: number[]) => void;
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
  topValues: SearchValueMapResult[] | undefined;
  fieldIndex?: number | undefined;
}

const StageSummaryUI: React.FC<SummaryStageProps> = ({
  stage,
  topValues,
  ...summaryProps
}) => {
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number>();

  const beginReorderingField = (fieldIndex: number) => {
    setSelectedFieldIndex(fieldIndex);
  };

  const currentFieldOrdering = stage.items
    .map((item) => ("fieldIndex" in item ? item.fieldIndex : undefined))
    .filter(notUndefined);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const currentIndex = currentFieldOrdering.findIndex(
        (fieldIndex) => fieldIndex === selectedFieldIndex
      );
      const moveOffset =
        event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      const otherIndex = currentIndex + moveOffset;
      if (
        currentIndex > -1 &&
        moveOffset !== 0 &&
        otherIndex >= 0 &&
        otherIndex < currentFieldOrdering.length
      ) {
        const newList = [...currentFieldOrdering];
        const tempItem = newList[currentIndex];
        newList[currentIndex] = newList[otherIndex];
        newList[otherIndex] = tempItem;
        summaryProps.updateFieldOrder(summaryProps.stagePath, newList);
        setSelectedFieldIndex(otherIndex);
      }
    };
    window.addEventListener("keyup", handle);
    return () => window.removeEventListener("keyup", handle);
  });

  return (
    <FieldListDiv>
      {stage.items.map((item, index) => (
        <SummaryItem
          key={`${item.type}/${index}`}
          item={item}
          stageSummary={stage.items}
          beginReorderingField={beginReorderingField}
          isSelected={
            "fieldIndex" in item && item.fieldIndex === selectedFieldIndex
          }
          deselect={() => setSelectedFieldIndex(undefined)}
          topValues={topValues}
          {...summaryProps}
        />
      ))}
    </FieldListDiv>
  );
};

const FieldListDiv = styled.div`
  display: flex;
  gap: 2px;
  flex-direction: column;
`;

interface ClickToPopoverProps {
  popoverContent: (props: {
    setOpen: (open: boolean) => void;
    closeMenu: () => void;
  }) => ReactElement;
  content: (props: { isOpen: boolean; closeMenu: () => void }) => ReactElement;
}

const ClickToPopover: React.FC<ClickToPopoverProps> = ({
  popoverContent,
  content,
}) => {
  const [open, setOpen] = useState(false);
  const closing = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    closing.current = true;
    setOpen(false);
  };

  useEffect(() => {
    closing.current = false;
  }, [open]);

  return (
    <>
      <ClickToPopoverDiv onClick={() => !closing.current && setOpen(true)}>
        <div ref={ref} key={open ? "open" : "closed"}>
          {content({ isOpen: open, closeMenu })}
        </div>
        <Popover open={open} setOpen={setOpen} referenceDiv={ref}>
          {popoverContent({ setOpen, closeMenu })}
        </Popover>
      </ClickToPopoverDiv>
    </>
  );
};

const ClickToPopoverDiv = styled.div`
  position: relative;
`;

interface SummaryItemProps {
  item: QuerySummaryItem;
  source: StructDef;
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
  toggleField: (stagePath: StagePath, fieldPath: string) => void;
  addFilter: (stagePath: StagePath, filter: FilterExpression) => void;
  addLimit: (stagePath: StagePath, limit: number) => void;
  addOrderBy: (
    stagePath: StagePath,
    fieldIndex: number,
    direction?: "asc" | "desc"
  ) => void;
  addNewNestedQuery: (stagePath: StagePath, name: string) => void;
  editFilter: (
    stagePath: StagePath,
    fieldIndex: number | undefined,
    filterIndex: number,
    filter: FilterExpression
  ) => void;
  stagePath: StagePath;
  addNewDimension: (stagePath: StagePath, dimension: QueryFieldDef) => void;
  addNewMeasure: (stagePath: StagePath, measure: QueryFieldDef) => void;
  replaceWithDefinition: (stagePath: StagePath, fieldIndex: number) => void;
  setDataStyle: (name: string, renderer: RendererName | undefined) => void;
  addStage: (stagePath: StagePath, fieldIndex: number) => void;
  removeStage: (stagePath: StagePath) => void;
  updateFieldOrder: (stagePath: StagePath, ordering: number[]) => void;
  stageSummary: QuerySummaryItem[];
  beginReorderingField: (fieldIndex: number) => void;
  editDimension: (
    stagePath: StagePath,
    fieldIndex: number,
    dimension: QueryFieldDef
  ) => void;
  editOrderBy: (
    stagePath: StagePath,
    orderByIndex: number,
    direction: "asc" | "desc" | undefined
  ) => void;
  editMeasure: (
    stagePath: StagePath,
    fieldIndex: number,
    measure: QueryFieldDef
  ) => void;
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
  fieldIndex?: number | undefined;
  isSelected: boolean;
  deselect: () => void;
  topValues: SearchValueMapResult[] | undefined;
}

const SummaryItem: React.FC<SummaryItemProps> = ({
  item,
  source,
  stagePath,
  fieldIndex,
  stageSummary,
  isSelected,
  beginReorderingField,
  deselect,
  topValues,
  ...query
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const children: {
    childItem: QuerySummaryItem;
    fieldIndex?: number;
  }[] = [];
  if ("styles" in item && item.styles) {
    children.push(...item.styles.map((childItem) => ({ childItem })));
  }
  if ("filters" in item && item.filters) {
    children.push(
      ...item.filters.map((childItem) => ({
        childItem,
        fieldIndex: item.fieldIndex,
      }))
    );
  }

  useClickOutside(ref, () => isSelected && deselect());

  return (
    <div ref={ref}>
      <ClickToPopover
        popoverContent={({ closeMenu }) => {
          if (item.type === "field" || item.type === "field_definition") {
            if (item.kind === "dimension") {
              return (
                <DimensionActionMenu
                  source={source}
                  removeField={() =>
                    query.removeField(stagePath, item.fieldIndex)
                  }
                  rename={(newName) => {
                    query.renameField(stagePath, item.fieldIndex, newName);
                  }}
                  closeMenu={closeMenu}
                  setDataStyle={(renderer) =>
                    query.setDataStyle(item.name, renderer)
                  }
                  stagePath={stagePath}
                  stageSummary={stageSummary}
                  updateFieldOrder={query.updateFieldOrder}
                  fieldIndex={item.fieldIndex}
                  beginReorderingField={() => {
                    beginReorderingField(item.fieldIndex);
                    closeMenu();
                  }}
                  name={item.name}
                  isEditable={item.type === "field_definition"}
                  canSave={item.saveDefinition !== undefined}
                  definition={
                    item.type === "field_definition" ? item.source : undefined
                  }
                  saveDimension={() => {
                    item.saveDefinition &&
                      query.saveDimension(
                        stagePath,
                        item.fieldIndex,
                        item.name,
                        item.saveDefinition
                      );
                  }}
                  editDimension={(fieldIndex, dimension) =>
                    query.editDimension(stagePath, fieldIndex, dimension)
                  }
                />
              );
            } else if (item.kind === "measure") {
              const isRenamed =
                item.type === "field_definition" ||
                (item.kind === "measure" && item.isRenamed);
              return (
                <AggregateActionMenu
                  source={source}
                  removeField={() =>
                    query.removeField(stagePath, item.fieldIndex)
                  }
                  addFilter={(filter, as) =>
                    query.addFilterToField(
                      stagePath,
                      item.fieldIndex,
                      filter,
                      as
                    )
                  }
                  rename={(newName) => {
                    query.renameField(stagePath, item.fieldIndex, newName);
                  }}
                  closeMenu={closeMenu}
                  setDataStyle={(renderer) =>
                    query.setDataStyle(item.name, renderer)
                  }
                  isRenamed={isRenamed}
                  beginReorderingField={() => {
                    beginReorderingField(item.fieldIndex);
                    closeMenu();
                  }}
                  fieldIndex={item.fieldIndex}
                  name={item.name}
                  isEditable={item.type === "field_definition"}
                  definition={
                    item.type === "field_definition" ? item.source : undefined
                  }
                  canSave={item.saveDefinition !== undefined}
                  editMeasure={(fieldIndex, dimension) =>
                    query.editMeasure(stagePath, fieldIndex, dimension)
                  }
                  saveMeasure={() => {
                    item.saveDefinition &&
                      query.saveMeasure(
                        stagePath,
                        item.fieldIndex,
                        item.name,
                        item.saveDefinition
                      );
                  }}
                  topValues={topValues}
                />
              );
            } else {
              return (
                <SavedQueryActionMenu
                  source={source}
                  removeField={() =>
                    query.removeField(stagePath, item.fieldIndex)
                  }
                  addFilter={(filter) =>
                    query.addFilterToField(stagePath, item.fieldIndex, filter)
                  }
                  renameField={(newName) => {
                    query.renameField(stagePath, item.fieldIndex, newName);
                  }}
                  addLimit={() => {
                    /* unused, unimplemented */
                  }}
                  replaceWithDefinition={() =>
                    query.replaceWithDefinition(stagePath, item.fieldIndex)
                  }
                  closeMenu={closeMenu}
                  setDataStyle={(renderer) =>
                    query.setDataStyle(item.name, renderer)
                  }
                  beginReorderingField={() => {
                    beginReorderingField(item.fieldIndex);
                    closeMenu();
                  }}
                />
              );
            }
          } else if (item.type === "filter") {
            return (
              <FilterActionMenu
                source={source}
                filterSource={item.filterSource}
                removeFilter={() =>
                  query.removeFilter(stagePath, item.filterIndex)
                }
                editFilter={(filter) =>
                  query.editFilter(
                    stagePath,
                    fieldIndex,
                    item.filterIndex,
                    filter
                  )
                }
                closeMenu={closeMenu}
              />
            );
          } else if (item.type === "limit") {
            return (
              <LimitActionMenu
                removeLimit={() => query.removeLimit(stagePath)}
                editLimit={(limit) => query.editLimit(stagePath, limit)}
                closeMenu={closeMenu}
                limit={item.limit}
              />
            );
          } else if (item.type === "order_by") {
            return (
              <OrderByActionMenu
                removeOrderBy={() =>
                  query.removeOrderBy(stagePath, item.orderByIndex)
                }
                closeMenu={closeMenu}
                orderByField={item.byField}
                orderByIndex={item.orderByIndex}
                existingDirection={item.direction}
                editOrderBy={(direction) =>
                  query.editOrderBy(stagePath, item.orderByIndex, direction)
                }
              />
            );
          } else if (item.type === "data_style") {
            return (
              <DataStyleActionMenu
                onComplete={closeMenu}
                setDataStyle={(renderer) =>
                  query.setDataStyle(item.styleKey, renderer)
                }
                allowedRenderers={item.allowedRenderers}
              />
            );
          } else if (item.type === "nested_query_definition") {
            const nestStagePath = stagePathPush(stagePath, {
              fieldIndex: item.fieldIndex,
              stageIndex: 0,
            });
            return (
              <NestQueryActionMenu
                source={source}
                toggleField={query.toggleField}
                addFilter={query.addFilter}
                addLimit={query.addLimit}
                addOrderBy={query.addOrderBy}
                addNewNestedQuery={query.addNewNestedQuery}
                stagePath={nestStagePath}
                remove={() => query.removeField(stagePath, item.fieldIndex)}
                orderByFields={item.stages[0].orderByFields}
                addNewDimension={query.addNewDimension}
                addNewMeasure={query.addNewMeasure}
                closeMenu={closeMenu}
                setDataStyle={(renderer) =>
                  query.setDataStyle(item.name, renderer)
                }
                addStage={() => query.addStage(stagePath, item.fieldIndex)}
                stageSummary={item.stages[0].items}
                updateFieldOrder={query.updateFieldOrder}
                topValues={topValues}
                rename={(newName) => {
                  query.renameField(stagePath, item.fieldIndex, newName);
                }}
                canSave={item.saveDefinition !== undefined}
                saveQuery={() => {
                  item.saveDefinition &&
                    query.saveNestQuery(
                      stagePath,
                      item.fieldIndex,
                      item.name,
                      item.saveDefinition
                    );
                }}
                beginReorderingField={() => {
                  beginReorderingField(item.fieldIndex);
                  closeMenu();
                }}
              />
            );
          } else if (item.type === "error_field") {
            return (
              <ErrorFieldActionMenu
                remove={() => query.removeField(stagePath, item.fieldIndex)}
                closeMenu={closeMenu}
              />
            );
          } else {
            return <div />;
          }
        }}
        content={({ isOpen, closeMenu }) => {
          if (item.type === "field" || item.type === "field_definition") {
            const isSaved = item.type === "field" && !item.isRefined;
            let button: ReactElement;
            if (item.kind === "dimension") {
              button = (
                <FieldButton
                  icon={<ActionIcon action="group_by" />}
                  name={item.name}
                  unsaved={!isSaved}
                  canRemove={true}
                  onRemove={() => {
                    query.removeField(stagePath, item.fieldIndex);
                    closeMenu();
                  }}
                  color="dimension"
                  active={isOpen || isSelected}
                />
              );
            } else if (item.kind === "measure") {
              button = (
                <FieldButton
                  icon={<ActionIcon action="aggregate" />}
                  name={item.name}
                  canRemove={true}
                  unsaved={!isSaved}
                  onRemove={() => {
                    query.removeField(stagePath, item.fieldIndex);
                    closeMenu();
                  }}
                  color="measure"
                  active={isOpen || isSelected}
                />
              );
            } else {
              button = (
                <FieldButton
                  icon={<ActionIcon action="nest" />}
                  name={item.name}
                  canRemove={true}
                  onRemove={() => {
                    query.removeField(stagePath, item.fieldIndex);
                    closeMenu();
                  }}
                  color="query"
                  active={isOpen || isSelected}
                />
              );
            }
            return (
              <HoverToPopover
                width={300}
                enabled={!isOpen}
                content={() => button}
                zIndex={9}
                popoverContent={() => {
                  return (
                    <FieldDetailPanel
                      fieldPath={item.type === "field" ? item.path : undefined}
                      definition={
                        item.type !== "field" ? item.source : undefined
                      }
                      topValues={undefined}
                    />
                  );
                }}
              />
            );
          } else if (item.type === "filter") {
            return (
              <HoverToPopover
                width={300}
                enabled={!isOpen}
                zIndex={9}
                content={() => (
                  <FieldButton
                    icon={<ActionIcon action="filter" />}
                    name={item.filterSource}
                    canRemove={true}
                    onRemove={() => {
                      query.removeFilter(
                        stagePath,
                        item.filterIndex,
                        fieldIndex
                      );
                      closeMenu();
                    }}
                    color="filter"
                    active={isOpen || isSelected}
                  />
                )}
                popoverContent={() => {
                  return (
                    <FieldDetailPanel
                      filterExpression={item.filterSource}
                      topValues={undefined}
                    />
                  );
                }}
              />
            );
          } else if (item.type === "limit") {
            return (
              <FieldButton
                icon={<ActionIcon action="limit" />}
                name={`limit: ${item.limit}`}
                canRemove={true}
                onRemove={() => {
                  query.removeLimit(stagePath);
                  closeMenu();
                }}
                color="other"
                active={isOpen || isSelected}
              />
            );
          } else if (item.type === "order_by") {
            return (
              <FieldButton
                icon={<ActionIcon action="order_by" />}
                name={`${item.byField.name} ${item.direction || ""}`}
                canRemove={true}
                onRemove={() => {
                  query.removeOrderBy(stagePath, item.orderByIndex);
                  closeMenu();
                }}
                color="other"
                active={isOpen || isSelected}
              />
            );
          } else if (item.type === "data_style") {
            return (
              <FieldButton
                icon={<VisIcon renderer={item.renderer} />}
                name={item.renderer}
                color="other"
                canRemove={item.canRemove}
                onRemove={() => {
                  query.setDataStyle(item.styleKey, undefined);
                  closeMenu();
                }}
                active={isOpen || isSelected}
              />
            );
          } else if (item.type === "nested_query_definition") {
            return (
              <FieldButton
                icon={<ActionIcon action="nest" />}
                name={item.name}
                unsaved={true}
                canRemove={true}
                onRemove={() => {
                  query.removeField(stagePath, item.fieldIndex);
                  closeMenu();
                }}
                color="query"
                active={isOpen || isSelected}
              />
            );
          } else if (item.type === "error_field") {
            return (
              <FieldButton
                icon={<ActionIcon action="error" />}
                name={item.name}
                unsaved={false}
                canRemove={true}
                onRemove={() => {
                  query.removeField(stagePath, item.fieldIndex);
                  closeMenu();
                }}
                color="error"
                active={isOpen || isSelected}
              />
            );
          } else {
            return <div />;
          }
        }}
      />
      {item.type === "nested_query_definition" &&
        (item.stages[0].items.length > 0 || item.stages.length > 1) &&
        item.stages.map((stage, stageIndex) => {
          const nestStagePath = stagePathPush(stagePath, {
            fieldIndex: item.fieldIndex,
            stageIndex,
          });
          return (
            <ListNest key={"stage/" + stageIndex}>
              {item.stages.length > 1 && (
                <ClickToPopover
                  popoverContent={({ closeMenu }) => (
                    <StageActionMenu
                      source={stage.inputSource}
                      toggleField={query.toggleField}
                      addFilter={query.addFilter}
                      addLimit={query.addLimit}
                      addOrderBy={query.addOrderBy}
                      addNewNestedQuery={query.addNewNestedQuery}
                      stagePath={nestStagePath}
                      remove={() => query.removeStage(nestStagePath)}
                      orderByFields={stage.orderByFields}
                      addNewDimension={query.addNewDimension}
                      addNewMeasure={query.addNewMeasure}
                      closeMenu={closeMenu}
                      setDataStyle={(renderer) =>
                        query.setDataStyle(item.name, renderer)
                      }
                      isLastStage={stageIndex === item.stages.length - 1}
                      stageSummary={stage.items}
                      updateFieldOrder={query.updateFieldOrder}
                      topValues={topValues}
                    />
                  )}
                  content={({ isOpen }) => (
                    <StageButton active={isOpen}>
                      Stage {stageIndex + 1}
                      <BackPart className="back">
                        <CloseIconStyled
                          color="other"
                          width="20px"
                          height="20px"
                          className="close"
                          onClick={() => query.removeStage(nestStagePath)}
                        />
                      </BackPart>
                    </StageButton>
                  )}
                />
              )}
              <StageSummaryUI
                stage={stage}
                stagePath={nestStagePath}
                source={source}
                topValues={topValues}
                {...query}
              />
              {/* <FieldListDiv>
          { stage.items.map((item, index) => {
            return <SummaryItem
              key={"child:" + index}
              item={item}
              source={source}
              stagePath={nestStagePath}
              fieldIndex={fieldIndex}
              stageSummary={stageSummary}
              {...query}
            />;
          })}
        </FieldListDiv> */}
            </ListNest>
          );
        })}
      {children.length > 0 && (
        <ListNest>
          <FieldListDiv>
            {children.map(({ childItem, fieldIndex }, index) => {
              return (
                <SummaryItem
                  key={"child:" + index}
                  item={childItem}
                  source={source}
                  stagePath={stagePath}
                  fieldIndex={fieldIndex}
                  stageSummary={stageSummary}
                  isSelected={false}
                  beginReorderingField={() => {
                    // Only used for filters, reordering not needed
                  }}
                  deselect={() => {
                    // Only used for filters, reordering not needed
                  }}
                  topValues={topValues}
                  {...query}
                />
              );
            })}
          </FieldListDiv>
        </ListNest>
      )}
    </div>
  );
};

export const StageButton = styled.div<{
  active: boolean;
}>`
  text-transform: uppercase;
  font-size: 12px;
  border: none;
  overflow: hidden;
  background-color: transparent;
  border-radius: 50px;
  padding: 5px 7px 5px 10px;
  text-align: left;
  margin-bottom: 2px;
  user-select: none;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  font-family: "Google Sans";
  color: #9aa0a6;

  &:hover {
    .back {
      visibility: visible;
    }
  }

  .back {
    visibility: hidden;
  }

  &:hover {
    background-color: #f7f8f8;
  }

  ${({ active }) => {
    return active
      ? `
      background-color: #f7f8f8;
      .back {
        visibility: visible;
      }
    `
      : "";
  }}
`;
