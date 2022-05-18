import * as crypto from "crypto";

import { MalloyQueryData } from "./model/malloy_types";

export interface ResultCacheEntry {
  data: MalloyQueryData;
}

const DEFAULT_CACHE_DURATION = 30 * 60 * 1000;

export class MalloyResultCache<T extends ResultCacheEntry = ResultCacheEntry> {
  private resultCache = new Map<string, T>();

  constructor(private cacheDuration = DEFAULT_CACHE_DURATION) {}

  getHash(...keys: Array<string | number>): string {
    const hash = crypto.createHash("md5");
    keys.forEach((key) => hash.update(key.toString()));
    return hash.digest("hex");
  }

  put(hash: string, entry: T): void {
    this.resultCache.set(hash, entry);
  }

  retrieve(hash: string): T | undefined {
    const entry = this.resultCache.get(hash);
    if (entry) {
      const { data } = entry;
      if (data.metadata.ranAt + this.cacheDuration > Date.now()) {
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
