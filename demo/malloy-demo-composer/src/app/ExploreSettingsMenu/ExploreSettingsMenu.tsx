/*
 * Copyright 2022 Google LLC
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
import { ActionIcon } from "../ActionIcon";
import { ConnectionsEditor } from "../ConnectionsEditor";
import { Modal } from "../Modal";

interface ExploreSettingsMenuProps {
  foo: number;
}

export const ExploreSettingsMenu: React.FC<ExploreSettingsMenuProps> = ({
  foo,
}) => {
  const [connectionsOpen, setConnectionsOpen] = useState(false);

  return (
    <>
      <ActionIcon action="group_by" onClick={() => setConnectionsOpen(true)} />
      <Modal open={connectionsOpen} setOpen={setConnectionsOpen}>
        <ConnectionsEditor foo={foo} />
      </Modal>
    </>
  );
};
