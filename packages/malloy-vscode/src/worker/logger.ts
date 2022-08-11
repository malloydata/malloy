/* eslint-disable no-console */
import { WorkerLogMessage } from "./types";
export const log = (message: string): void => {
  const msg: WorkerLogMessage = {
    type: "log",
    message,
  };
  process.send?.(msg);
};
