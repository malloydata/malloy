import React, { useContext, useEffect, useState } from "react";
import { QueryPanelMessage, QueryRunStatus } from "../../extension/types";
import { VSCodeContext } from "../vscodeContext";

export const App: React.FC = () => {
  const vscode = useContext(VSCodeContext);
  const [status, setStatus] = useState<QueryRunStatus | undefined>();
  const [blob, setBlob] = useState<any>();
  const [times, setTimes] = useState<string[]>();

  useEffect(() => {
    const listener = (event: MessageEvent<QueryPanelMessage>) => {
      const message = event.data; // The JSON data our extension sent

      // eslint-disable-next-line no-empty
      switch (message.type) {
        case "query-status":
          setStatus(message.status);
          if (message.status === QueryRunStatus.Done) {
            setBlob(message.sizeTest.map((x) => x.length).toString());
            setTimes([message.time, new Date().toLocaleTimeString()])
          }
          break;
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  });

  return <div>Status: {status}, Times: {times}, Blob: {JSON.stringify(blob, null, 2)}</div>;
};
