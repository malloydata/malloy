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
  ContextMenuTitle,
  ButtonAndInputRow,
} from "../CommonElements";

interface RenameFieldProps {
  rename: (newName: string) => void;
  onComplete: () => void;
}

export const RenameField: React.FC<RenameFieldProps> = ({
  rename,
  onComplete,
}) => {
  const [name, setName] = useState("");
  return (
    <ContextMenuMain>
      <ContextMenuTitle>Rename</ContextMenuTitle>
      <ButtonAndInputRow>
        <CodeInput
          value={name}
          setValue={setName}
          placeholder="new_name"
          autoFocus={true}
        />
        <Button
          type="submit"
          onClick={() => {
            rename(name);
            onComplete();
          }}
        >
          Done
        </Button>
      </ButtonAndInputRow>
    </ContextMenuMain>
  );
};
