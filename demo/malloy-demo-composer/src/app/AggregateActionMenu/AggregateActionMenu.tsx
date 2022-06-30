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

import { FilterExpression, StructDef } from "@malloydata/malloy";
import { OrderByField, RendererName, StagePath } from "../../types";
import { FilterContextBar } from "../FilterContextBar";
import { RenameField } from "../RenameField";
import { ActionMenu } from "../ActionMenu";
import { DataStyleContextBar } from "../DataStyleContextBar";
import { AddNewMeasure } from "../AddNewMeasure";
import { QueryFieldDef, SearchValueMapResult } from "@malloydata/malloy";
import { EditOrderBy } from "../EditOrderBy";

interface AggregateActionMenuProps {
  source: StructDef;
  removeField: () => void;
  addFilter: (filter: FilterExpression, as?: string) => void;
  rename: (newName: string) => void;
  closeMenu: () => void;
  setDataStyle: (renderer: RendererName) => void;
  isRenamed: boolean;
  fieldIndex: number;
  beginReorderingField: () => void;
  isEditable: boolean;
  name: string;
  definition: string | undefined;
  editMeasure: (fieldIndex: number, measure: QueryFieldDef) => void;
  topValues: SearchValueMapResult[] | undefined;
  canSave: boolean;
  saveMeasure?: () => void;
  addOrderBy: (
    stagePath: StagePath,
    fieldIndex: number,
    direction?: "asc" | "desc"
  ) => void;
  orderByField: OrderByField;
  stagePath: StagePath;
  analysisPath: string;
}

export const AggregateActionMenu: React.FC<AggregateActionMenuProps> = ({
  source,
  addFilter,
  rename,
  closeMenu,
  setDataStyle,
  beginReorderingField,
  isRenamed,
  editMeasure,
  name,
  definition,
  isEditable,
  fieldIndex,
  topValues,
  saveMeasure,
  canSave,
  addOrderBy,
  orderByField,
  stagePath,
  analysisPath,
}) => {
  return (
    <ActionMenu
      closeMenu={closeMenu}
      actions={[
        {
          kind: "sub_menu",
          id: "filter",
          iconName: "filter",
          iconColor: "filter",
          label: "Filter",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <FilterContextBar
              analysisPath={analysisPath}
              source={source}
              addFilter={addFilter}
              onComplete={onComplete}
              needsRename={!isRenamed}
              topValues={topValues}
            />
          ),
        },
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
        {
          kind: "sub_menu",
          id: "edit_definition",
          label: "Edit Definition",
          iconName: "edit",
          iconColor: "other",
          isEnabled: isEditable,
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <AddNewMeasure
              source={source}
              addMeasure={(code) => editMeasure(fieldIndex, code)}
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
          label: "Save Measure",
          iconName: "save",
          isEnabled: canSave,
          iconColor: "measure",
          onClick: () => {
            saveMeasure && saveMeasure();
          },
        },
      ]}
    />
  );
};
