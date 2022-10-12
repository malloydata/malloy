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
} from "@malloydata/malloy";
import {
  RendererName,
  StagePath,
  QuerySummaryItem,
  OrderByField,
} from "../../types";
import { ActionMenu } from "../ActionMenu";
import { AddFilter } from "../AddFilter";
import { AddNewDimension } from "../AddNewDimension";
import { DataStyleContextBar } from "../DataStyleContextBar";
import { EditOrderBy } from "../EditOrderBy";
import { RenameField } from "../RenameField";

interface DimensionActionMenuProps {
  removeField: () => void;
  rename: (name: string) => void;
  closeMenu: () => void;
  setDataStyle: (renderer: RendererName) => void;
  updateFieldOrder: (stagePath: StagePath, ordering: number[]) => void;
  stagePath: StagePath;
  fieldIndex: number;
  stageSummary: QuerySummaryItem[];
  beginReorderingField: () => void;
  isEditable: boolean;
  name: string;
  definition: string | undefined;
  editDimension: (fieldIndex: number, dimension: QueryFieldDef) => void;
  canSave: boolean;
  saveDimension?: () => void;
  source: StructDef;
  filterField?: FieldDef;
  filterFieldPath?: string;
  addFilter: (stagePath: StagePath, filterExpression: FilterExpression) => void;
  addOrderBy: (
    stagePath: StagePath,
    fieldIndex: number,
    direction?: "asc" | "desc"
  ) => void;
  orderByField: OrderByField;
  analysisPath: string;
}

export const DimensionActionMenu: React.FC<DimensionActionMenuProps> = ({
  source,
  rename,
  name,
  closeMenu,
  setDataStyle,
  fieldIndex,
  beginReorderingField,
  isEditable,
  editDimension,
  definition,
  saveDimension,
  canSave,
  filterField,
  filterFieldPath,
  addFilter,
  stagePath,
  addOrderBy,
  orderByField,
  analysisPath,
}) => {
  return (
    <ActionMenu
      closeMenu={closeMenu}
      actions={[
        {
          kind: "sub_menu",
          id: "rename",
          iconName: "rename",
          label: "Rename",
          iconColor: "other",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <RenameField rename={rename} onComplete={onComplete} />
          ),
        },
        {
          kind: "sub_menu",
          id: "filter_on",
          iconName: "filter",
          label: "Filter By",
          iconColor: "filter",
          closeOnComplete: true,
          Component: ({ onComplete }) =>
            filterField && filterFieldPath ? (
              <AddFilter
                analysisPath={analysisPath}
                onComplete={onComplete}
                source={source}
                field={filterField}
                fieldPath={filterFieldPath}
                needsRename={false}
                addFilter={(filter) => addFilter(stagePath, filter)}
              />
            ) : (
              <div />
            ),
        },
        {
          kind: "sub_menu",
          id: "order_by",
          iconName: "order_by",
          label: "Order By",
          iconColor: "other",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <EditOrderBy
              byField={orderByField}
              addOrderBy={(fieldIndex, direction) =>
                addOrderBy(stagePath, fieldIndex, direction)
              }
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
                "number",
                "boolean",
                "currency",
                "image",
                "link",
                "percent",
                "text",
                "time",
              ]}
            />
          ),
        },
        // {
        //   kind: "sub_menu",
        //   id: "reorder",
        //   label: "Move Field",
        //   iconName: "order_by",
        //   iconColor: "other",
        //   closeOnComplete: true,
        //   Component: ({ onComplete }) => <ReorderFieldsContextBar
        //     stageSummary={stageSummary}
        //     updateFieldOrder={(order) => updateFieldOrder(stagePath, order)}
        //     onComplete={onComplete}
        //     fieldIndex={fieldIndex}
        //   />
        // },
        {
          kind: "sub_menu",
          id: "edit_definition",
          label: "Edit Definition",
          iconName: "edit",
          isEnabled: isEditable,
          iconColor: "other",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <AddNewDimension
              source={source}
              addDimension={(code) => editDimension(fieldIndex, code)}
              onComplete={onComplete}
              initialCode={definition}
              initialName={name}
            />
          ),
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
          label: "Save Dimension",
          iconName: "save",
          isEnabled: canSave,
          iconColor: "dimension",
          onClick: () => {
            saveDimension && saveDimension();
          },
        },
      ]}
    />
  );
};
