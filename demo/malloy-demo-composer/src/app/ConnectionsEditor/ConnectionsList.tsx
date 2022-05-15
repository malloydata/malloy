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

import { ConnectionConfig } from "../../types";
import { Button } from "../CommonElements";

interface ConnectionsListProps {
  connections: ConnectionConfig[];
  onEdit: (connection: ConnectionConfig) => void;
}

export const ConnectionsList: React.FC<ConnectionsListProps> = ({
  connections,
  onEdit,
}) => {
  return (
    <div>
      {connections.map((connection) => {
        return (
          <div key={connection.id}>
            {connection.name}
            <Button onClick={() => onEdit(connection)}>Edit</Button>
          </div>
        );
      })}
    </div>
  );
};
