import { MessageConfig } from "./types";
import { CONNECTION_MANAGER } from "../server/connections";

export const refreshConfig = ({ config }: MessageConfig): void => {
  CONNECTION_MANAGER.setConnectionsConfig(config.connections);
};
