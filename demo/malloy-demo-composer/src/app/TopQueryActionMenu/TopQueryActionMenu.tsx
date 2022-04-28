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
  OrderByField,
  StagePath,
  RendererName,
  QuerySummaryItem,
} from "../../types";
import { AggregateContextBar } from "../AggregateContextBar";
import { GroupByContextBar } from "../GroupByContextBar";
import { NestContextBar } from "../NestContextBar";
import { FilterContextBar } from "../FilterContextBar";
import { AddLimit } from "../AddLimit";
import { OrderByContextBar } from "../OrderByContextBar";
import { FilterExpression } from "@malloydata/malloy";
import { ActionMenu } from "../ActionMenu";
import {
  QueryFieldDef,
  SearchValueMapResult,
  StructDef,
} from "@malloydata/malloy";
import { DataStyleContextBar } from "../DataStyleContextBar";
import { LoadQueryContextBar } from "../LoadQueryContextBar";
import {
  fieldToSummaryItem,
  flatFields,
  pathParent,
  termsForField,
} from "../utils";

interface TopQueryActionMenuProps {
  source: StructDef;
  toggleField: (stagePath: StagePath, fieldPath: string) => void;
  addFilter: (
    stagePath: StagePath,
    filter: FilterExpression,
    as?: string
  ) => void;
  addLimit: (stagePath: StagePath, limit: number) => void;
  addOrderBy: (
    stagePath: StagePath,
    byFieldIndex: number,
    direction?: "asc" | "desc"
  ) => void;
  addNewNestedQuery: (stagePath: StagePath, name: string) => void;
  addNewDimension: (stagePath: StagePath, dimension: QueryFieldDef) => void;
  addNewMeasure: (stagePath: StagePath, measure: QueryFieldDef) => void;
  stagePath: StagePath;
  orderByFields: OrderByField[];
  closeMenu: () => void;
  setDataStyle: (name: string, renderer: RendererName) => void;
  addStage: (stagePath: StagePath | undefined, fieldIndex?: number) => void;
  loadQuery: (queryPath: string) => void;
  updateFieldOrder: (stagePath: StagePath, newOrdering: number[]) => void;
  topValues: SearchValueMapResult[] | undefined;
  stageSummary: QuerySummaryItem[];
  queryName: string;
  isOnlyStage: boolean;
}

export const TopQueryActionMenu: React.FC<TopQueryActionMenuProps> = ({
  source,
  toggleField,
  addFilter,
  addLimit,
  addOrderBy,
  addNewNestedQuery,
  stagePath,
  orderByFields,
  addNewDimension,
  addNewMeasure,
  closeMenu,
  queryName,
  setDataStyle,
  loadQuery,
  addStage,
  topValues,
}) => {
  return (
    <ActionMenu
      topValues={topValues}
      valueSearchSource={source}
      addFilter={(filter) => addFilter(stagePath, filter)}
      closeMenu={closeMenu}
      actions={[
        {
          kind: "sub_menu",
          id: "group_by",
          label: "Group By",
          iconName: "group_by",
          iconColor: "dimension",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <GroupByContextBar
              topValues={topValues}
              source={source}
              addNewDimension={(dim) => addNewDimension(stagePath, dim)}
              selectField={(fieldPath) => toggleField(stagePath, fieldPath)}
              onComplete={onComplete}
            />
          ),
        },
        {
          kind: "sub_menu",
          id: "aggregate",
          label: "Aggregate",
          iconColor: "measure",
          iconName: "aggregate",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <AggregateContextBar
              source={source}
              selectField={(fieldPath) => toggleField(stagePath, fieldPath)}
              addNewMeasure={(def) => addNewMeasure(stagePath, def)}
              onComplete={onComplete}
            />
          ),
        },
        {
          kind: "sub_menu",
          id: "nest",
          label: "Nest",
          iconName: "nest",
          iconColor: "query",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <NestContextBar
              source={source}
              selectField={(fieldPath) => toggleField(stagePath, fieldPath)}
              selectNewNest={(name) => addNewNestedQuery(stagePath, name)}
              onComplete={onComplete}
            />
          ),
        },
        {
          kind: "sub_menu",
          id: "filter",
          label: "Filter",
          iconName: "filter",
          iconColor: "filter",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <FilterContextBar
              topValues={topValues}
              source={source}
              addFilter={(filter, as) => addFilter(stagePath, filter, as)}
              onComplete={onComplete}
              needsRename={false}
            />
          ),
        },
        {
          kind: "sub_menu",
          id: "limit",
          label: "Limit",
          iconName: "limit",
          iconColor: "other",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <AddLimit
              addLimit={(limit) => addLimit(stagePath, limit)}
              onComplete={onComplete}
            />
          ),
        },
        {
          kind: "sub_menu",
          id: "order_by",
          label: "Order By",
          iconName: "order_by",
          iconColor: "other",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <OrderByContextBar
              addOrderBy={(byField, direction) =>
                addOrderBy(stagePath, byField, direction)
              }
              orderByFields={orderByFields}
              onComplete={onComplete}
            />
          ),
        },
        {
          kind: "sub_menu",
          id: "style",
          label: "Style",
          iconName: "style",
          iconColor: "other",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <DataStyleContextBar
              setDataStyle={(renderer) => setDataStyle(queryName, renderer)}
              onComplete={onComplete}
              allowedRenderers={[
                "table",
                "bar_chart",
                "dashboard",
                "json",
                "line_chart",
                "list",
                "list_detail",
                "point_map",
                "scatter_chart",
                "segment_map",
                "shape_map",
                "spark_line",
              ]}
            />
          ),
        },
        {
          kind: "one_click",
          id: "add_stage",
          label: "Add Stage",
          iconName: "stage",
          iconColor: "other",
          onClick: () => addStage(undefined),
        },
        {
          kind: "sub_menu",
          id: "load_query",
          label: "Load Query",
          iconName: "load",
          iconColor: "query",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <LoadQueryContextBar
              source={source}
              selectField={loadQuery}
              onComplete={onComplete}
            />
          ),
        },
      ]}
      searchItems={flatFields(source).map(({ field, path }) => ({
        item: fieldToSummaryItem(field, path),
        terms: termsForField(field, path),
        detail: pathParent(path),
        key: path,
        select: () => toggleField(stagePath, path),
      }))}
    />
  );
};
