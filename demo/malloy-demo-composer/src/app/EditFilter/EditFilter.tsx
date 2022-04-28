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
import { useState } from "react";
import { compileFilter } from "../../core/compile";
import { CodeInput } from "../CodeInput";
import {
  Button,
  RightButtonRow,
  ContextMenuMain,
  ContextMenuTitle,
} from "../CommonElements";

interface EditFilterProps {
  source: StructDef;
  existing: string;
  editFilter: (filter: FilterExpression) => void;
  onComplete: () => void;
}

export const EditFilter: React.FC<EditFilterProps> = ({
  existing,
  editFilter,
  source,
  onComplete,
}) => {
  const [filter, setFilter] = useState(existing);
  return (
    <ContextMenuMain>
      <ContextMenuTitle>Edit Filter</ContextMenuTitle>
      <form>
        <CodeInput
          value={filter}
          setValue={setFilter}
          placeholder="filter_expression"
          autoFocus={true}
        />
        <RightButtonRow>
          <Button
            type="submit"
            onClick={() => {
              compileFilter(source, filter).then((filterExpression) => {
                editFilter(filterExpression);
                onComplete();
              });
            }}
          >
            Done
          </Button>
        </RightButtonRow>
      </form>
    </ContextMenuMain>
  );
};
