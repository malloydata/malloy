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
import { CodeInput } from "../CodeInput";
import { Button, ButtonAndInputRow, ContextMenuTitle } from "../CommonElements";
import { Popover } from "../Popover";

interface SaveQueryPopoverProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  saveQuery: (name: string) => void;
}

export const SaveQueryPopover: React.FC<SaveQueryPopoverProps> = ({
  saveQuery,
  open,
  setOpen,
}) => {
  const [name, setName] = useState("");
  return (
    <Popover open={open} setOpen={setOpen}>
      <Content>
        <ContextMenuTitle>Save Query</ContextMenuTitle>
        <ButtonAndInputRow>
          <CodeInput
            value={name}
            setValue={setName}
            placeholder="query_name"
            autoFocus={true}
          />
          <Button
            type="submit"
            onClick={() => {
              saveQuery(name);
              setName("");
            }}
          >
            Save
          </Button>
        </ButtonAndInputRow>
      </Content>
    </Popover>
  );
};

const Content = styled.div`
  padding: 15px;
`;

interface UseSaveQueryPopoverResult {
  saveQueryPopover: JSX.Element;
  openSaveQueryPopover: () => void;
}

export function useSaveQueryPopover({
  saveQuery,
}: {
  saveQuery: (name: string) => void;
}): UseSaveQueryPopoverResult {
  const [open, setOpen] = useState(false);

  const saveQueryPopover = (
    <SaveQueryPopover
      open={open}
      setOpen={setOpen}
      saveQuery={(name) => {
        saveQuery(name);
        setOpen(false);
      }}
    />
  );

  return { saveQueryPopover, openSaveQueryPopover: () => setOpen(true) };
}
