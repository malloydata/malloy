import { CONNECTION_MANAGER } from "../state";

export const clearCacheCommand = async (): Promise<void> => {
  const connections = CONNECTION_MANAGER.connections.toArray();
  for (const connection of connections) {
    connection.clearCache();
  }
};
