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

import React from "react";
import { ActionIcon } from "../ActionIcon";
import { useSaveQueryPopover } from "../SaveQueryPopover";

interface SaveQueryButtonProps {
  saveQuery: (name: string) => void;
}

export const SaveQueryButton: React.FC<SaveQueryButtonProps> = ({
  saveQuery,
}) => {
  const { saveQueryPopover, openSaveQueryPopover } = useSaveQueryPopover({
    saveQuery,
  });
  return (
    <>
      <ActionIcon
        action="save"
        onClick={openSaveQueryPopover}
        color="dimension"
      />
      {saveQueryPopover}
    </>
  );
};
