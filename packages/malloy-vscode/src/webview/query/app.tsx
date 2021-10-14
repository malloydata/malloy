import { StructDef } from "malloy";
import { DataTreeRoot, HtmlView } from "malloy-render";
import React, { useContext, useEffect, useState } from "react";
import { QueryPanelMessage, QueryRunStatus } from "../../extension/types";
import { VSCodeContext } from "../vscodeContext";

const css = `<style>
body {
	background-color: transparent;
  font-size: 11px;
}
</style>
`;

export const App: React.FC = () => {
  const vscode = useContext(VSCodeContext);
  const [status, setStatus] = useState<QueryRunStatus | undefined>();
  const [resultHtml, setResultHtml] = useState<string | undefined>();

  useEffect(() => {
    const listener = (event: MessageEvent<QueryPanelMessage>) => {
      const message = event.data; // The JSON data our extension sent

      // eslint-disable-next-line no-empty
      switch (message.type) {
        case "query-status":
          setStatus(message.status);
          if (message.status === QueryRunStatus.Done) {
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


              (async () => {
                const html =
                  // css + (await new HtmlView().render(table, message.styles));
                  "foo";
                setResultHtml(html);
                console.log(html);
              })();
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
      Status: {status}
      <div dangerouslySetInnerHTML={{ __html: resultHtml || "" }} />
    </div>
  );
};
