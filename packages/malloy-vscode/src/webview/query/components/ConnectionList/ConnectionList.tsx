import React from "react";
import styled from "styled-components";
import { Button } from "..";
import { Connection } from "../../types";

interface ConnectionListProps {
  connections: Connection[];
  beginEdit: (index: number) => void;
  beginTest: (index: number) => void;
}

const Actions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: center;
`;

export const ConnectionList: React.FC<ConnectionListProps> = ({
  connections,
  beginEdit,
  beginTest,
}) => (
  <div>
    You have {connections.length} configured connection
    {connections.length === 1 ? "" : "s"}.
    <ConnectionTable>
      <tr>
        <th>Name</th>
        <th>Type</th>
        <th>Actions</th>
      </tr>
      {connections.map((connection, index) => {
        return (
          <tr key={index}>
            <td>{connection.name}</td>
            <td>{connection.type}</td>
            <td>
              <Actions>
                <Button onClick={() => beginEdit(index)}>Edit</Button>
                <Button onClick={() => beginTest(index)} color="success">
                  Test
                </Button>
              </Actions>
            </td>
          </tr>
        );
      })}
    </ConnectionTable>
  </div>
);

const ConnectionTable = styled.table`
  border: 1px solid #d3d3d3;
  border-spacing: 8px;
  width: 100%;
  margin-top: 10px;
  margin-bottom: 10px;

  td {
    text-align: center;
  }
`;
