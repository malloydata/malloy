import { CONNECTION_MANAGER } from "../server/connections";
import { log } from "./logger";
import { cancel_query, run_query } from "./run_query";
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
      cancel_query(message.panelId);
      break;
    case "exit":
      exitFlag = true;
      break;
    case "run":
      run_query(message.query, message.panelId);
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
