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

import { Result } from "@malloydata/malloy";
import { HTMLView, JSONView } from "@malloydata/render";
import React, { useEffect, useState } from "react";
import {
  QueryMessageType,
  QueryPanelMessage,
  QueryRenderMode,
  QueryRunStatus,
} from "../../webview_message_manager";
import { Spinner } from "../components";

enum Status {
  Ready = "ready",
  Compiling = "compiling",
  Running = "running",
  Error = "error",
  Displaying = "displaying",
  Rendering = "rendering",
  Done = "done",
}

export const App: React.FC = () => {
  const [status, setStatus] = useState<Status>(Status.Ready);
  const [rendered, setRendered] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const listener = (event: MessageEvent<QueryPanelMessage>) => {
      const message = event.data;

      switch (message.type) {
        case QueryMessageType.QueryStatus:
          if (message.status === QueryRunStatus.Error) {
            setStatus(Status.Error);
            setError(message.error);
          } else {
            setError(undefined);
          }
          if (message.status === QueryRunStatus.Done) {
            setStatus(Status.Rendering);
            setTimeout(async () => {
              const result = Result.fromJSON(message.result).data;
              const rendered = await (message.mode === QueryRenderMode.HTML
                ? new HTMLView().render(result, message.styles)
                : new JSONView().render(result));
              setStatus(Status.Displaying);
              setTimeout(() => {
                setRendered(rendered);
                setStatus(Status.Done);
              }, 0);
            }, 0);
          } else {
            setRendered("");
            switch (message.status) {
              case QueryRunStatus.Compiling:
                setStatus(Status.Compiling);
                break;
              case QueryRunStatus.Running:
                setStatus(Status.Running);
                break;
            }
          }
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  });

  return (
    <div style={{ height: "100%" }}>
      {[
        Status.Compiling,
        Status.Running,
        Status.Rendering,
        Status.Displaying,
      ].includes(status) ? (
        <Spinner text={getStatusLabel(status) || ""} />
      ) : (
        ""
      )}
      <div
        dangerouslySetInnerHTML={{ __html: rendered }}
        style={{ padding: "10px" }}
      ></div>
      {error && <div>{error}</div>}
    </div>
  );
};

function getStatusLabel(status: Status) {
  switch (status) {
    case Status.Compiling:
      return "Compiling";
    case Status.Running:
      return "Running";
    case Status.Rendering:
      return "Rendering";
    case Status.Displaying:
      return "Displaying";
  }
}
