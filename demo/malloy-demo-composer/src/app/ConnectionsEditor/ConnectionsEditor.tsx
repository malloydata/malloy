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
import { ConnectionBackend, ConnectionConfig } from "../../types";
import {
  Button,
  ContextMenuMain,
  ContextMenuTitle,
  RightButtonRow,
} from "../CommonElements";
import { ConnectionEditor } from "./ConnectionEditor";
import { ConnectionsList } from "./ConnectionsList";

interface ConnectionsEditorProps {
  foo: number;
}

function randomUUID() {
  return Math.random().toString();
}

export const ConnectionsEditor: React.FC<ConnectionsEditorProps> = ({
  foo,
}) => {
  const [connections, setConnections] = useState<
    Record<string, ConnectionConfig>
  >({});
  const [editingConnection, setEditingConnection] = useState<
    ConnectionConfig | undefined
  >();

  if (editingConnection !== undefined) {
    return (
      <ContextMenuMain>
        <ContextMenuTitle>Edit Connection</ContextMenuTitle>
        <ConnectionEditor
          config={editingConnection}
          setConfig={setEditingConnection}
        />
        <RightButtonRow>
          <Button
            onClick={() => {
              const id = editingConnection.id || randomUUID();
              setConnections({
                ...connections,
                [id]: { ...editingConnection, id },
              });
              setEditingConnection(undefined);
            }}
          >
            Done
          </Button>
        </RightButtonRow>
      </ContextMenuMain>
    );
  }

  return (
    <ContextMenuMain>
      <ContextMenuTitle>Connections</ContextMenuTitle>
      <ConnectionsList
        onEdit={setEditingConnection}
        connections={Object.values(connections)}
      />
      <RightButtonRow>
        <Button
          onClick={() =>
            setEditingConnection({
              backend: ConnectionBackend.BigQuery,
              name: "",
              id: "",
              isDefault: false,
            })
          }
        >
          New Connection
        </Button>
        <Button>Done</Button>
      </RightButtonRow>
    </ContextMenuMain>
  );
};
