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
      return undefined;
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
