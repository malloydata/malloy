import * as crypto from "crypto";

import { MalloyQueryData } from "@malloydata/malloy";

export interface ResultCacheEntry {
  data: MalloyQueryData;
}

export class MalloyResultCache<T extends ResultCacheEntry = ResultCacheEntry> {
  private resultCache = new Map<string, T>();

  getHash(...keys: Array<string | number>): string {
    const hash = crypto.createHash("md5");
    keys.forEach((key) => hash.update(key.toString()));
    return hash.digest("hex");
  }

  put(hash: string, entry: T): void {
    this.resultCache.set(hash, entry);
  }

  retrieve(hash: string, cacheDuration: number): T | undefined {
    const entry = this.resultCache.get(hash);
    if (entry) {
      const { data } = entry;
      if (data.metadata.ranAt + cacheDuration * 1000 > Date.now()) {
        return {
          ...entry,
          data: { ...data, metadata: { ...data.metadata, fromCache: true } },
        };
      } else {
        this.eject(hash);
      }
    }
    return undefined;
  }

  eject(hash: string): void {
    this.resultCache.delete(hash);
  }
}
