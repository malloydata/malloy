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
import { compileDimension } from "../../core/compile";
import { CodeInput } from "../CodeInput";
import {
  Button,
  ContextMenuMain,
  RightButtonRow,
  ContextMenuTitle,
  FormFieldList,
} from "../CommonElements";
import { QueryFieldDef, StructDef } from "@malloydata/malloy";

interface AddFilterProps {
  source: StructDef;
  addDimension: (dimension: QueryFieldDef) => void;
  onComplete: () => void;
  initialCode?: string;
  initialName?: string;
}

export const AddNewDimension: React.FC<AddFilterProps> = ({
  source,
  addDimension,
  onComplete,
  initialCode,
  initialName,
}) => {
  const [dimension, setDimension] = useState(initialCode || "");
  const [newName, setNewName] = useState(initialName || "");
  const needsName = initialCode === undefined;
  return (
    <ContextMenuMain>
      <ContextMenuTitle>
        {needsName ? "New" : "Edit"} Dimension
      </ContextMenuTitle>
      <form>
        <FormFieldList>
          {needsName && (
            <CodeInput
              value={newName}
              setValue={setNewName}
              placeholder="field name"
              label="Field Name"
              autoFocus={true}
            />
          )}
          <CodeInput
            value={dimension}
            setValue={setDimension}
            placeholder="some_field * 10"
            label={needsName ? "Definition" : undefined}
          />
        </FormFieldList>
        <RightButtonRow>
          <Button
            type="submit"
            onClick={() => {
              compileDimension(source, newName, dimension).then((dimension) => {
                addDimension(dimension);
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
