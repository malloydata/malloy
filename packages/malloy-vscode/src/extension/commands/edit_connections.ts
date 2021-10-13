import * as vscode from "vscode";
import * as path from "path";
import { getWebviewHtml } from "../../webview";

export function editConnectionsCommand(): void {
  const otherPanel = vscode.window.createWebviewPanel(
    "malloyQuery",
    "Malloy Connections",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const onDiskPath = vscode.Uri.file(
    path.join(__filename, "..", "connections.js")
  );

  const entrySrc = otherPanel.webview.asWebviewUri(onDiskPath);

  otherPanel.webview.html = getWebviewHtml(entrySrc.toString());

  const config = vscode.workspace.getConfiguration("malloy");

  otherPanel.webview.postMessage({
    type: "config-set",
    config: config.get("connections"),
  });

  otherPanel.webview.onDidReceiveMessage(
    (message) => {
      switch (message.type) {
        case "config-set":
          config.update("connections", message.connections);
          break;
        case "test-connection":
          setTimeout(() => {
            otherPanel.webview.postMessage({
              type: "test-connection",
              connection: message.connection,
              status: "failure",
              error: "Nobody has implemented the connection tester, oops!",
            });
          }, 1000);
          break;
      }
    },
    undefined,
    [] // TODO actually add this to the context disposables
  );
}
