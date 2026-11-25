/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {DependencyTree, ModelDef} from '../../model';
import type {InvalidationKey, URLReader} from '../../runtime_types';
import {getInvalidationKey} from './readers';

interface CacheGetModelDefResponse {
  modelDef: ModelDef;
  invalidationKeys: {[url: string]: InvalidationKey};
}

/**
 * Where a `CacheManager` keeps compiled models. `InMemoryModelCache` lives
 * and dies with the process; a host may supply one that outlives it (a disk
 * directory, a database table) or that several `CacheManager`s share.
 *
 * A `CacheManager` checks every stored model against the current contents of
 * the Malloy files it was compiled from before using it, so a stale entry is a
 * miss, never a wrong answer. That check covers ONLY those files. A compiled
 * model also carries table schemas fetched through the connections it was
 * compiled with, and a URL alone does not say which connections those were. A
 * cache shared by runtimes whose connections differ (two projects that both
 * have a `file:///index.malloy`) must therefore be keyed by more than the URL,
 * for example one store per project or per connection configuration.
 */
export interface ModelCache {
  getModel(url: URL): Promise<CachedModel | undefined>;
  setModel(url: URL, cachedModel: CachedModel): Promise<boolean>;
}

export interface CachedModel {
  modelDef: ModelDef;
  invalidationKeys: {[url: string]: InvalidationKey};
}

export class CacheManager {
  private modelDependencies: Map<string, DependencyTree> = new Map();
  private modelInvalidationKeys: Map<string, InvalidationKey> = new Map();

  constructor(private modelCache: ModelCache) {}

  async getCachedModelDef(
    urlReader: URLReader,
    url: string
  ): Promise<CacheGetModelDefResponse | undefined> {
    const _dependencies = this.modelDependencies.get(url);
    if (_dependencies === undefined) {
      return await this.loadFromModelCache(urlReader, url);
    }
    const dependencies = [url, ...flatDeps(_dependencies)];
    const invalidationKeys: {[url: string]: InvalidationKey} = {};
    for (const dependency of dependencies) {
      const invalidationKey = this.modelInvalidationKeys.get(dependency);
      if (invalidationKey === undefined || invalidationKey === null) {
        return undefined;
      }
      invalidationKeys[dependency] = invalidationKey;
    }
    for (const dependency of dependencies) {
      const invalidationKey = await getInvalidationKey(
        urlReader,
        new URL(dependency)
      );
      if (invalidationKey !== invalidationKeys[dependency]) {
        return undefined;
      }
    }
    const cached = await this.modelCache.getModel(new URL(url));
    if (cached === undefined) {
      return undefined;
    }
    for (const dependency of dependencies) {
      if (
        cached.invalidationKeys[dependency] !== invalidationKeys[dependency]
      ) {
        return undefined;
      }
    }
    // Return the cached model def and the invalidation keys for this
    // model def's dependencies
    return {modelDef: cached.modelDef, invalidationKeys};
  }

  /**
   * Nothing in memory for `url`: this manager has neither compiled nor loaded
   * it. The `ModelCache` may still hold it, because a `ModelCache` can outlive
   * the `CacheManager` (a persistent store after a restart) or be shared by
   * several. Every stored invalidation key is checked against the reader, as
   * the in-memory path does; on a match the dependencies and keys are
   * remembered, so the next lookup takes the in-memory path.
   *
   * Any failure here (a store that throws, a file the reader no longer has) is
   * a miss, not an error: before this lookup existed the same call returned
   * `undefined`, and the compile that follows reports a missing file properly.
   */
  private async loadFromModelCache(
    urlReader: URLReader,
    url: string
  ): Promise<CacheGetModelDefResponse | undefined> {
    try {
      const cached = await this.modelCache.getModel(new URL(url));
      if (cached === undefined) {
        return undefined;
      }
      const dependencies = [url, ...flatDeps(cached.modelDef.dependencies)];
      const invalidationKeys: {[url: string]: InvalidationKey} = {};
      for (const dependency of dependencies) {
        const stored = cached.invalidationKeys[dependency];
        if (stored === undefined || stored === null) {
          return undefined;
        }
        const current = await getInvalidationKey(
          urlReader,
          new URL(dependency)
        );
        if (current !== stored) {
          return undefined;
        }
        invalidationKeys[dependency] = stored;
      }
      this.modelDependencies.set(url, cached.modelDef.dependencies);
      for (const dependency of dependencies) {
        this.modelInvalidationKeys.set(
          dependency,
          invalidationKeys[dependency]
        );
      }
      return {modelDef: cached.modelDef, invalidationKeys};
    } catch {
      return undefined;
    }
  }

  async setCachedModelDef(
    url: string,
    cachedModel: CachedModel
  ): Promise<boolean> {
    this.modelDependencies.set(url, cachedModel.modelDef.dependencies);
    const invalidationKeys: {[url: string]: InvalidationKey} = {};
    for (const dependency of [
      url,
      ...flatDeps(cachedModel.modelDef.dependencies),
    ]) {
      if (cachedModel.invalidationKeys[dependency] === null) {
        return false;
      }
      if (cachedModel.invalidationKeys[dependency] === undefined) {
        throw new Error(
          `Missing invalidation key for dependency ${dependency}`
        );
      }
      this.modelInvalidationKeys.set(
        dependency,
        cachedModel.invalidationKeys[dependency]
      );
      invalidationKeys[dependency] = cachedModel.invalidationKeys[dependency];
    }
    const result = await this.modelCache.setModel(new URL(url), {
      modelDef: cachedModel.modelDef,
      invalidationKeys,
    });
    if (result) {
      return true; // TODO just return `result` when it's a boolean
    }
    return false;
  }
}

function flatDeps(tree: DependencyTree): string[] {
  return [...Object.keys(tree), ...Object.values(tree).map(flatDeps).flat()];
}

// TODO maybe make this memory bounded....
export class InMemoryModelCache implements ModelCache {
  private readonly models = new Map<string, CachedModel>();

  public async getModel(url: URL): Promise<CachedModel | undefined> {
    return Promise.resolve(this.models.get(url.toString()));
  }

  public async setModel(url: URL, cachedModel: CachedModel): Promise<boolean> {
    this.models.set(url.toString(), cachedModel);
    return Promise.resolve(true);
  }
}
