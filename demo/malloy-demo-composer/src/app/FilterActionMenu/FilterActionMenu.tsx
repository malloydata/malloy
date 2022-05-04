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
import { ActionMenu } from "../ActionMenu";
import { EditFilter } from "../EditFilter";

interface FilterActionMenuProps {
  source: StructDef;
  filterSource: string;
  removeFilter: () => void;
  editFilter: (filter: FilterExpression) => void;
  closeMenu: () => void;
}

export const FilterActionMenu: React.FC<FilterActionMenuProps> = ({
  filterSource,
  editFilter,
  closeMenu,
  source,
}) => {
  return (
    <ActionMenu
      closeMenu={closeMenu}
      actions={[
        {
          id: "edit",
          label: "Change filter",
          iconName: "filter",
          iconColor: "filter",
          kind: "sub_menu",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <EditFilter
              editFilter={editFilter}
              onComplete={onComplete}
              existing={filterSource}
              source={source}
            />
          ),
        },
      ]}
    />
  );
};
