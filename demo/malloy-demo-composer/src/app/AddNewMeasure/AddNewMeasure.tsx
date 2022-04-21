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
import { compileMeasure } from "../../core/compile";
import { CodeInput } from "../CodeInput";
import {
  Button,
  ContextMenuTitle,
  ContextMenuMain,
  RightButtonRow,
  FormFieldList,
} from "../CommonElements";
import { QueryFieldDef, StructDef } from "@malloydata/malloy";

interface AddMeasureProps {
  source: StructDef;
  addMeasure: (measure: QueryFieldDef) => void;
  onComplete: () => void;
  initialCode?: string;
  initialName?: string;
}

export const AddNewMeasure: React.FC<AddMeasureProps> = ({
  source,
  addMeasure,
  onComplete,
  initialCode,
  initialName,
}) => {
  const [measure, setmeasure] = useState(initialCode || "");
  const [newName, setNewName] = useState(initialName || "");
  const needsName = initialCode === undefined;
  return (
    <ContextMenuMain>
      <ContextMenuTitle>{needsName ? "New" : "Edit"} measure</ContextMenuTitle>
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
            value={measure}
            setValue={setmeasure}
            placeholder="some_field * 10"
            label={needsName ? "Definition" : undefined}
          />
        </FormFieldList>
        <RightButtonRow>
          <Button
            type="submit"
            onClick={(event) => {
              compileMeasure(source, newName, measure)
                .then((measure) => {
                  addMeasure(measure);
                  onComplete();
                })
                // eslint-disable-next-line no-console
                .catch(console.log);
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            Done
          </Button>
        </RightButtonRow>
      </form>
    </ContextMenuMain>
  );
};
