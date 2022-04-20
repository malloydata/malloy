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

import { useState } from "react";
import styled from "styled-components";
import { OrderByField } from "../../types";
import {
  ContextMenuContent,
  ContextMenuMain,
  ContextMenuOuter,
  ContextMenuTitle,
  EmptyMessage,
} from "../CommonElements";
import { EditOrderBy } from "../EditOrderBy";
import { FieldButton } from "../FieldButton";
import { TypeIcon } from "../TypeIcon";

interface OrderByContextBarProps {
  addOrderBy: (byFieldIndex: number, direction?: "desc" | "asc") => void;
  orderByFields: OrderByField[];
  onComplete: () => void;
}

export const OrderByContextBar: React.FC<OrderByContextBarProps> = ({
  addOrderBy,
  orderByFields,
  onComplete,
}) => {
  const [byField, setByField] = useState<OrderByField | undefined>();

  if (orderByFields.length === 0) {
    return (
      <ContextMenuMain>
        <ContextMenuTitle>Order By</ContextMenuTitle>
        <EmptyMessage>You must add some fields first.</EmptyMessage>
      </ContextMenuMain>
    );
  }

  return (
    <div>
      {byField === undefined && (
        <ContextMenuOuter>
          <ContextMenuContent>
            <ListDiv>
              {orderByFields.map((field) => (
                <FieldButton
                  icon={<TypeIcon type={field.type} kind="dimension" />}
                  key={field.name}
                  onClick={() => setByField(field)}
                  name={field.name}
                  color="dimension"
                />
              ))}
            </ListDiv>
          </ContextMenuContent>
        </ContextMenuOuter>
      )}
      {byField !== undefined && (
        <EditOrderBy
          addOrderBy={addOrderBy}
          onComplete={onComplete}
          byField={byField}
        />
      )}
    </div>
  );
};

const ListDiv = styled.div`
  overflow: hidden;
  display: flex;
  gap: 2px;
  flex-direction: column;
`;
