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
  QuerySummaryItem,
  RendererName,
  StagePath,
} from "../../types";
import { AggregateContextBar } from "../AggregateContextBar";
import { GroupByContextBar } from "../GroupByContextBar";
import { NestContextBar } from "../NestContextBar";
import { FilterContextBar } from "../FilterContextBar";
import { AddLimit } from "../AddLimit";
import { OrderByContextBar } from "../OrderByContextBar";
import { ActionMenu } from "../ActionMenu";
import {
  FilterExpression,
  QueryFieldDef,
  SearchValueMapResult,
  StructDef,
} from "@malloydata/malloy";
import { DataStyleContextBar } from "../DataStyleContextBar";
import {
  fieldToSummaryItem,
  flatFields,
  pathParent,
  termsForField,
} from "../utils";
import { RenameField } from "../RenameField";

interface NestQueryActionMenuProps {
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
  stagePath: StagePath;
  remove: () => void;
  orderByFields: OrderByField[];
  addNewDimension: (stagePath: StagePath, dimension: QueryFieldDef) => void;
  addNewMeasure: (stagePath: StagePath, measure: QueryFieldDef) => void;
  closeMenu: () => void;
  setDataStyle: (rendererName: RendererName) => void;
  addStage: () => void;
  stageSummary: QuerySummaryItem[];
  updateFieldOrder: (stagePath: StagePath, ordering: number[]) => void;
  beginReorderingField: () => void;
  topValues: SearchValueMapResult[] | undefined;
  saveQuery: () => void;
  rename: (newName: string) => void;
  canSave: boolean;
  analysisPath: string;
}

export const NestQueryActionMenu: React.FC<NestQueryActionMenuProps> = ({
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
  setDataStyle,
  beginReorderingField,
  addStage,
  topValues,
  saveQuery,
  canSave,
  rename,
  analysisPath,
}) => {
  return (
    <ActionMenu
      topValues={topValues}
      valueSearchSource={source}
      valueSearchAnalysisPath={analysisPath}
      addFilter={(filter) => addFilter(stagePath, filter)}
      closeMenu={closeMenu}
      actions={[
        {
          kind: "sub_menu",
          id: "group_by",
          label: "Group By",
          iconColor: "dimension",
          iconName: "group_by",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <GroupByContextBar
              source={source}
              selectField={(fieldPath) => toggleField(stagePath, fieldPath)}
              addNewDimension={(def) => addNewDimension(stagePath, def)}
              onComplete={onComplete}
              topValues={topValues}
            />
          ),
        },
        {
          kind: "sub_menu",
          id: "aggregate",
          label: "Aggregate",
          iconName: "aggregate",
          iconColor: "measure",
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
              analysisPath={analysisPath}
              source={source}
              addFilter={(filter, as) => addFilter(stagePath, filter, as)}
              onComplete={onComplete}
              needsRename={false}
              topValues={topValues}
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
              setDataStyle={setDataStyle}
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
        // {
        //   kind: "sub_menu",
        //   id: "reorder",
        //   label: "Reorder Fields",
        //   iconName: "order_by",
        //   iconColor: "other",
        //   closeOnComplete: true,
        //   Component: ({ onComplete }) => <ReorderFieldsContextBar
        //     stageSummary={stageSummary}
        //     updateFieldOrder={(order) => updateFieldOrder(stagePath, order)}
        //     onComplete={onComplete}
        //   />
        // },
        {
          kind: "sub_menu",
          id: "rename",
          iconName: "rename",
          iconColor: "other",
          label: "Rename",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <RenameField rename={rename} onComplete={onComplete} />
          ),
        },
        {
          kind: "one_click",
          id: "add_stage",
          label: "Add stage",
          iconName: "stage",
          iconColor: "other",
          onClick: addStage,
        },
        {
          kind: "one_click",
          id: "move",
          iconName: "move",
          iconColor: "other",
          label: "Move",
          onClick: beginReorderingField,
        },
        {
          kind: "one_click",
          id: "save_definition",
          label: "Save Query",
          iconName: "save",
          isEnabled: canSave,
          iconColor: "query",
          onClick: saveQuery,
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
