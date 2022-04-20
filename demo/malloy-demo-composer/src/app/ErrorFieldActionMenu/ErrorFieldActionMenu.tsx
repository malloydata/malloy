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

interface ErrorFieldActionMenuProps {
  remove: () => void;
  closeMenu: () => void;
}

export const ErrorFieldActionMenu: React.FC<ErrorFieldActionMenuProps> = ({
  remove,
  closeMenu,
}) => {
  return (
    <ActionMenu
      closeMenu={closeMenu}
      actions={[
        {
          kind: "one_click",
          id: "remove",
          iconName: "remove",
          iconColor: "other",
          label: "Remove",
          onClick: remove,
        },
      ]}
    />
  );
};
