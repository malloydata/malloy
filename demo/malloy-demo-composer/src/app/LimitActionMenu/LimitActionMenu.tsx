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

import { ActionMenu } from "../ActionMenu";
import { AddLimit } from "../AddLimit";

interface LimitActionMenuProps {
  limit: number;
  removeLimit: () => void;
  editLimit: (limit: number) => void;
  closeMenu: () => void;
}

export const LimitActionMenu: React.FC<LimitActionMenuProps> = ({
  limit,
  editLimit,
  closeMenu,
}) => {
  return (
    <ActionMenu
      closeMenu={closeMenu}
      actions={[
        {
          id: "edit",
          label: "Change limit",
          iconName: "limit",
          iconColor: "other",
          kind: "sub_menu",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <AddLimit
              addLimit={editLimit}
              onComplete={onComplete}
              existing={limit}
            />
          ),
        },
      ]}
    />
  );
};
