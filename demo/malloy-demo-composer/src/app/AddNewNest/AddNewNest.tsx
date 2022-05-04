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
import { CodeInput } from "../CodeInput";
import {
  Button,
  ContextMenuMain,
  RightButtonRow,
  ContextMenuTitle,
} from "../CommonElements";

interface AddNewNestProps {
  addNest: (name: string) => void;
  onComplete: () => void;
}

export const AddNewNest: React.FC<AddNewNestProps> = ({
  addNest,
  onComplete,
}) => {
  const [name, setName] = useState("");
  return (
    <ContextMenuMain>
      <ContextMenuTitle>New Nested Query</ContextMenuTitle>
      <form>
        <CodeInput
          value={name}
          setValue={setName}
          placeholder="query_name"
          autoFocus={true}
        />
        <RightButtonRow>
          <Button
            type="submit"
            onClick={() => {
              addNest(name);
              onComplete();
            }}
          >
            Done
          </Button>
        </RightButtonRow>
      </form>
    </ContextMenuMain>
  );
};
