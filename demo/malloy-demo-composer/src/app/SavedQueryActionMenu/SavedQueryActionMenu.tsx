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
import { RendererName } from "../../types";
import { ActionMenu } from "../ActionMenu";
import { DataStyleContextBar } from "../DataStyleContextBar";
import { RenameField } from "../RenameField";

interface SavedQueryActionMenuProps {
  source: StructDef;
  removeField: () => void;
  addFilter: (filter: FilterExpression) => void;
  addLimit: () => void;
  renameField: (newName: string) => void;
  replaceWithDefinition: () => void;
  closeMenu: () => void;
  setDataStyle: (renderer: RendererName) => void;
  beginReorderingField: () => void;
}

export const SavedQueryActionMenu: React.FC<SavedQueryActionMenuProps> = ({
  renameField,
  replaceWithDefinition,
  closeMenu,
  setDataStyle,
  beginReorderingField,
}) => {
  return (
    <ActionMenu
      closeMenu={closeMenu}
      actions={[
        {
          kind: "sub_menu",
          id: "rename",
          iconName: "rename",
          iconColor: "other",
          label: "Rename",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <RenameField rename={renameField} onComplete={onComplete} />
          ),
        },
        {
          kind: "sub_menu",
          id: "style",
          label: "Style",
          iconColor: "other",
          iconName: "style",
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
        {
          kind: "one_click",
          id: "expand_definition",
          label: "Duplicate",
          iconName: "duplicate",
          iconColor: "other",
          onClick: replaceWithDefinition,
        },
        {
          kind: "one_click",
          id: "move",
          iconName: "move",
          iconColor: "other",
          label: "Move",
          onClick: beginReorderingField,
        },
      ]}
    />
  );
};
