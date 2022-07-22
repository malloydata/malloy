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
  Button,
  ContextMenuMain,
  ContextMenuTitle,
  FieldIcon,
  FieldLabel,
  FormFieldList,
  RightButtonRow,
  SmallFieldName,
} from "../CommonElements";
import { SelectList } from "../SelectDropdown/SelectDropdown";
import { TypeIcon } from "../TypeIcon";
import { kindOfField, typeOfField } from "../utils";

interface EditOrderByProps {
  byField: OrderByField;
  addOrderBy: (
    fieldIndex: number,
    direction: "asc" | "desc" | undefined
  ) => void;
  onComplete: () => void;
  initialDirection?: "asc" | "desc";
}

export const EditOrderBy: React.FC<EditOrderByProps> = ({
  byField,
  addOrderBy,
  onComplete,
  initialDirection,
}) => {
  const [direction, setDirection] = useState<"asc" | "desc" | undefined>(
    initialDirection || "asc"
  );
  return (
    <ContextMenuMain>
      <ContextMenuTitle>
        Order By
        <FieldLabel>
          <FieldIcon color="dimension">
            <TypeIcon
              type={typeOfField(byField)}
              kind={kindOfField(byField)}
            ></TypeIcon>
          </FieldIcon>
          <SmallFieldName>{byField.name}</SmallFieldName>
        </FieldLabel>
      </ContextMenuTitle>
      <form>
        <FormFieldList>
          <OptionsRow>
            <SelectList
              options={[
                { value: "asc", label: "Ascending" },
                { value: "desc", label: "Descending" },
              ]}
              value={direction}
              onChange={setDirection}
            />
          </OptionsRow>
        </FormFieldList>
        <RightButtonRow>
          <Button
            type="submit"
            onClick={() => {
              if (byField !== undefined) {
                addOrderBy(byField.fieldIndex, direction);
                onComplete();
              }
            }}
          >
            Done
          </Button>
        </RightButtonRow>
      </form>
    </ContextMenuMain>
  );
};

const OptionsRow = styled.div`
  display: flex;
  border: 1px solid #efefef;
  border-radius: 5px;
  overflow: hidden;
`;
