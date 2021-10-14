import React, { useContext, useEffect, useState } from "react";
import {
  Button,
  ConnectionEdit,
  ConnectionList,
  ConnectionTest,
} from "./components";
import { Connection } from "./types";
import { VSCodeContext } from "../vscodeContext";

interface EditingState {
  index: number;
  connection: Connection;
}

interface TestingState {
  connection: Connection;
  status: "success" | "failure" | undefined;
  error?: string;
}

export const App: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [editing, setEditing] = useState<EditingState | undefined>();
  const [testing, setTesting] = useState<TestingState | undefined>();
  const vscode = useContext(VSCodeContext);

  useEffect(() => {
    const listener = (event: MessageEvent<any>) => {
      const message = event.data; // The JSON data our extension sent

      switch (message.type) {
        case "config-set":
          setConnections(message.config);
          break;
        case "test-connection":
          setTesting({
            connection: message.connection,
            status: message.status,
            error: message.error,
          });
          break;
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  });

  useEffect(() => {
    vscode.postMessage({ type: "config-set", connections });
  }, [connections]);

  return (
    <div>
      <ConnectionList
        connections={connections}
        beginEdit={(index) =>
          setEditing({ index, connection: connections[index] })
        }
        beginTest={(index) => {
          vscode.postMessage({
            type: "test-connection",
            connection: connections[index],
          });
          setTesting({ connection: connections[index], status: undefined });
        }}
      />
      <Button
        onClick={() =>
          setEditing({
            index: connections.length,
            connection: { name: "", type: "bigquery" },
          })
        }
      >
        New Connection
      </Button>
      {editing && (
        <ConnectionEdit
          connection={editing.connection}
          setConnection={(connection) => {
            const newConnections: Connection[] = [...connections];
            setEditing(undefined);
            newConnections[editing.index] = connection;
            setConnections(newConnections);
          }}
        />
      )}
      {testing && (
        <ConnectionTest
          connection={testing.connection}
          status={testing.status}
          error={testing.error}
        />
      )}
    </div>
  );
};
