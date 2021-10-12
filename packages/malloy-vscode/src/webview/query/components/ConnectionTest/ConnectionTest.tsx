import React from "react";
import { Connection } from "../../types";

interface ConnectionTestProps {
  connection: Connection;
  status: "success" | "failure" | undefined;
  error?: string;
}

export const ConnectionTest: React.FC<ConnectionTestProps> = ({
  connection,
  status,
  error,
}) => {
  return (
    <div>
      Testing connection {connection.name}...
      {status}
      {error && <div>Error: {error}</div>}
    </div>
  );
};
