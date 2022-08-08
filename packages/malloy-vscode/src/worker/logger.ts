import * as fs from "fs";

const logFile = fs.openSync("/tmp/worker.log", "w+");
export const log = (msg: string): void => {
  fs.writeFileSync(logFile, `${new Date().toLocaleString()}: ${msg}\n`);
};
