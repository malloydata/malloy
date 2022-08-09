import { CONNECTION_MANAGER } from "../server/connections";
import { log } from "./logger";
import { cancelQuery, runQuery } from "./run_query";
import { downloadQuery } from "./download_query";
import { Message } from "./types";

let exitFlag = false;

log("Worker started");

process.send?.({ type: "started" });
Object.values(CONNECTION_MANAGER.configs).forEach((connection) => {
  log(`Available: ${connection.name}`);
});

process.on("message", (message: Message) => {
  switch (message.type) {
    case "cancel":
      cancelQuery(message);
      break;
    case "exit":
      exitFlag = true;
      break;
    case "run":
      runQuery(message);
      break;
    case "download":
      downloadQuery(message);
      break;
  }
  log(`Message: ${JSON.stringify(message)}`);
});

process.on("exit", () => {
  log("Worker exited");
});

const heartBeat = setInterval(() => {
  log("Heartbeat");
  if (exitFlag) {
    clearInterval(heartBeat);
  }
}, 30 * 1000);
