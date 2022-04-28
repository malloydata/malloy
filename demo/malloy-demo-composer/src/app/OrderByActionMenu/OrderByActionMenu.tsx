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

import { OrderByField } from "../../types";
import { ActionMenu } from "../ActionMenu";
import { EditOrderBy } from "../EditOrderBy";

interface OrderByActionMenuProps {
  removeOrderBy: () => void;
  editOrderBy: (direction: "asc" | "desc" | undefined) => void;
  closeMenu: () => void;
  orderByField: OrderByField;
  existingDirection: "asc" | "desc" | undefined;
  orderByIndex: number;
}

export const OrderByActionMenu: React.FC<OrderByActionMenuProps> = ({
  closeMenu,
  editOrderBy,
  orderByField,
  existingDirection,
}) => {
  return (
    <ActionMenu
      closeMenu={closeMenu}
      actions={[
        {
          kind: "sub_menu",
          id: "edit",
          iconName: "order_by",
          iconColor: "other",
          label: "Edit Order By",
          closeOnComplete: true,
          Component: ({ onComplete }) => (
            <EditOrderBy
              addOrderBy={(byField, direction) => editOrderBy(direction)}
              onComplete={onComplete}
              byField={orderByField}
              initialDirection={existingDirection}
            />
          ),
        },
      ]}
    />
  );
};
