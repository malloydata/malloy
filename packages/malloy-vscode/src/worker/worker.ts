import { log } from "./logger";
import { cancelQuery, runQuery } from "./run_query";
import { downloadQuery } from "./download_query";
import { Message } from "./types";
import { refreshConfig } from "./refresh_config";

log("Worker started");

process.send?.({ type: "started" });

const heartBeat = setInterval(() => {
  log("Heartbeat");
}, 60 * 1000);

process.on("message", (message: Message) => {
  switch (message.type) {
    case "cancel":
      cancelQuery(message);
      break;
    case "config":
      refreshConfig(message);
      break;
    case "download":
      downloadQuery(message);
      break;
    case "exit":
      clearInterval(heartBeat);
      break;
    case "run":
      runQuery(message);
      break;
  }
});

process.on("exit", () => {
  log("Worker exited");
});

process.on("SIGHUP", () => {
  clearInterval(heartBeat);
});
