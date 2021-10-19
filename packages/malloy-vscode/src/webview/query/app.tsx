import { StructDef } from "malloy";
import { DataTreeRoot, HtmlView } from "malloy-render";
import React, { useContext, useEffect, useState } from "react";
import { QueryPanelMessage, QueryRunStatus } from "../../extension/types";
import { Button } from "../connections/components";
import { useWebviewState } from "../useWebviewState";
import { VSCodeContext } from "../vscodeContext";
import { Spinner } from "./components";

const css = `<style>
body {
	background-color: transparent;
  font-size: 11px;
}
</style>
`;

export const App: React.FC = () => {
  const vscode = useContext(VSCodeContext);
  const [error, setError] = useWebviewState<string | undefined>(
    "error",
    undefined
  );
  const [status, setStatus] = useWebviewState<QueryRunStatus | undefined>(
    "status",
    undefined
  );
  const [resultElement, setResultElement] = useState<Element | undefined>(
    undefined
  );

  const onDrill = (drillQuery: string) => {
    vscode.postMessage({
      type: "drill",
      query: drillQuery + " project * limit 10",
    });
  };

  useEffect(() => {
    const listener = (event: MessageEvent<QueryPanelMessage>) => {
      const message = event.data; // The JSON data our extension sent

      // eslint-disable-next-line no-empty
      switch (message.type) {
        case "query-status":
          setStatus(message.status);
          console.log(`Webview: ${message.status}} @ ${new Date()}`);
          if (message.status === QueryRunStatus.Error) {
            setError(message.error);
          } else if (message.status === QueryRunStatus.Done) {
            setStatus(QueryRunStatus.Rendering);

            const data = message.result;
            const field = data.structs.find(
              (s) => s.name === data.lastStageName
            );

            // const namedQueryName =
            //   query.type === "named" ? query.name : undefined;
            if (field) {
              const namedField: StructDef = {
                ...field,
                name: data.queryName || field.name,
              };
              const table = new DataTreeRoot(
                data.result,
                namedField,
                data.sourceExplore,
                data.sourceFilters || []
              );

              setTimeout(async () => {
                const element = await new HtmlView().render(
                  table,
                  message.styles,
                  document,
                  onDrill
                );
                setResultElement(element);
                setStatus(QueryRunStatus.Done);
              });
            }
          }
          break;
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  });

  return (
    <div>
      {status &&
        status !== QueryRunStatus.Error &&
        status !== QueryRunStatus.Done && <Spinner text={status.toString()} />}
      <Button
        disabled={status !== QueryRunStatus.Done}
        onClick={() => {
          vscode.postMessage({ type: "show_json" });
        }}
      >
        Show JSON
      </Button>
      {status && status === QueryRunStatus.Done && (
        <div ref={(ref) => resultElement && ref?.appendChild(resultElement)} />
      )}
      {status === QueryRunStatus.Error && <div>{error}</div>}
    </div>
  );
};
