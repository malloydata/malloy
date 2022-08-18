/*
 * Copyright 2022 Google LLC
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

import { OrderByField, StagePath, QuerySummaryItem } from "../../types";
import { AggregateContextBar } from "../AggregateContextBar";
import { GroupByContextBar } from "../GroupByContextBar";
import { NestContextBar } from "../NestContextBar";
import { FilterContextBar } from "../FilterContextBar";
import { AddLimit } from "../AddLimit";
import { OrderByContextBar } from "../OrderByContextBar";
import { ActionMenu } from "../ActionMenu";
import { SearchValueMapResult, StructDef } from "@malloydata/malloy";
import { DataStyleContextBar } from "../DataStyleContextBar";
import { LoadQueryContextBar } from "../LoadQueryContextBar";
import {
  fieldToSummaryItem,
  flatFields,
  pathParent,
  termsForField,
} from "../utils";
import { QueryModifiers } from "../hooks/use_query_builder";

interface TopQueryActionMenuProps {
  source: StructDef;
  stagePath: StagePath;
  orderByFields: OrderByField[];
  closeMenu: () => void;
  topValues: SearchValueMapResult[] | undefined;
  stageSummary: QuerySummaryItem[];
  queryName: string;
  isOnlyStage: boolean;
  analysisPath: string;
  queryModifiers: QueryModifiers;
}

export const TopQueryActionMenu: React.FC<TopQueryActionMenuProps> = ({
  source,
  stagePath,
  orderByFields,
  closeMenu,
  queryName,
  topValues,
  analysisPath,
  queryModifiers,
}) => {
  return (
    <ActionMenu
      topValues={topValues}
      valueSearchSource={source}
      valueSearchAnalysisPath={analysisPath}
      addFilter={(filter) => queryModifiers.addFilter(stagePath, filter)}
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
              addNewDimension={(dim) =>
                queryModifiers.addNewDimension(stagePath, dim)
              }
              selectField={(fieldPath) =>
                queryModifiers.toggleField(stagePath, fieldPath)
              }
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
              selectField={(fieldPath) =>
                queryModifiers.toggleField(stagePath, fieldPath)
              }
              addNewMeasure={(def) =>
                queryModifiers.addNewMeasure(stagePath, def)
              }
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
              selectField={(fieldPath) =>
                queryModifiers.toggleField(stagePath, fieldPath)
              }
              selectNewNest={(name) =>
                queryModifiers.addNewNestedQuery(stagePath, name)
              }
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
              addFilter={(filter, as) =>
                queryModifiers.addFilter(stagePath, filter, as)
              }
              onComplete={onComplete}
              needsRename={false}
              analysisPath={analysisPath}
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
              addLimit={(limit) => queryModifiers.addLimit(stagePath, limit)}
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
                queryModifiers.addOrderBy(stagePath, byField, direction)
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
              setDataStyle={(renderer) =>
                queryModifiers.setDataStyle(queryName, renderer)
              }
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
          onClick: () => queryModifiers.addStage(undefined),
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
              selectField={queryModifiers.loadQuery}
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
        select: () => queryModifiers.toggleField(stagePath, path),
      }))}
    />
  );
};
