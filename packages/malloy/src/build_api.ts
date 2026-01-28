/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {makeDigest} from './model/utils';
import type {
  Annotation,
  CompiledQuery,
  ModelDef,
  NamedQueryDef,
  PrepareResultOptions,
  SourceDef,
} from './model';
import {isSourceDef, QueryModel, buildInternalGraph} from './model';
import type {Dialect} from './dialect';
import {getDialect} from './dialect';
import type {TagParseSpec, MalloyTagParse} from './annotation';
import {annotationToTag, annotationToTaglines} from './annotation';
import type {Taggable} from './taggable';
import type {Connection, LookupConnection} from './connection/types';

/**
 * Identity of a node in the build graph.
 */
export interface BuildNodeId {
  /** Human-readable query name */
  name: string;
  /** Unique identity for cache lookup */
  queryDigest: string;
}

/**
 * A node in the build graph.
 */
export interface BuildNode {
  id: BuildNodeId;
  /** Dependencies of this node. Present for DAG reconstruction, not build ordering. */
  dependsOn: BuildNodeId[];
}

/**
 * An ordered build plan for a model.
 *
 * The leveled array structure determines build order: queries in the same
 * level can be built in parallel, levels must be built sequentially.
 *
 * The `dependsOn` fields in each BuildNode are for reconstructing the
 * original dependency DAG, not for determining build order.
 */
export type BuildGraph = BuildNode[][];

/**
 * A named query from a compiled Model, designed for the persist builder.
 * Provides access to query identity, SQL generation, and metadata needed
 * for building and caching query results.
 */
export class BuildQuery implements Taggable {
  constructor(
    private readonly def: NamedQueryDef,
    private readonly queryModel: QueryModel,
    private readonly resolveSource: (name: string) => SourceDef | undefined
  ) {}

  /**
   * The name of this query.
   */
  get name(): string {
    return this.def.name;
  }

  /**
   * The annotation on this query (for checking #@ persist, etc.)
   */
  get annotation(): Annotation | undefined {
    return this.def.annotation;
  }

  /**
   * Parse the query's tags.
   */
  tagParse(spec?: TagParseSpec): MalloyTagParse {
    return annotationToTag(this.def.annotation, spec);
  }

  /**
   * Get annotation taglines matching an optional prefix.
   */
  getTaglines(prefix?: RegExp): string[] {
    return annotationToTaglines(this.def.annotation, prefix);
  }

  /**
   * The source definition for this query.
   */
  private get sourceDef(): SourceDef {
    const structRef = this.def.structRef;
    const modelDef = this.queryModel.modelDef;
    if (!modelDef) {
      throw new Error('QueryModel has no modelDef');
    }
    const source =
      typeof structRef === 'string' ? modelDef.contents[structRef] : structRef;
    if (!isSourceDef(source)) {
      throw new Error('Invalid source for query');
    }
    return source;
  }

  /**
   * The connection name for this query's source.
   */
  get connectionName(): string {
    return this.sourceDef.connection;
  }

  /**
   * The dialect name for this query's source.
   */
  get dialectName(): string {
    return this.sourceDef.dialect;
  }

  /**
   * The dialect for this query's source.
   */
  get dialect(): Dialect {
    return getDialect(this.dialectName);
  }

  /**
   * Get the digest for this query from the QueryModel's digest map.
   * Returns undefined if not in the map.
   */
  getDigest(): string | undefined {
    return this.queryModel.persistedQueryDigests[this.name];
  }

  /**
   * Compile this query to SQL.
   *
   * @param options - If options includes a manifest, persisted dependencies
   *   are substituted with table names from the manifest.
   *   If not provided, returns "identity SQL" with everything expanded.
   */
  compileQuery(options?: PrepareResultOptions): CompiledQuery {
    return this.queryModel.compileQuery(this.def, options, true);
  }

  /**
   * Get the query definition.
   */
  get queryDef(): NamedQueryDef {
    return this.def;
  }
}

/**
 * A compiled Malloy model, designed for the persist builder.
 * Provides access to queries and build graphs for persistence workflows.
 */
export class BuildModel {
  private _queryModel?: QueryModel;

  constructor(
    private readonly modelDef: ModelDef,
    private readonly connections: LookupConnection<Connection>
  ) {}

  /**
   * Lazily create and cache a QueryModel for this model.
   */
  private get queryModel(): QueryModel {
    if (!this._queryModel) {
      this._queryModel = new QueryModel(this.modelDef);
    }
    return this._queryModel;
  }

  /**
   * Resolve a source name to its definition.
   */
  private resolveSource = (name: string): SourceDef | undefined => {
    const obj = this.modelDef.contents[name];
    return obj && isSourceDef(obj) ? obj : undefined;
  };

  /**
   * Get the connection name for a query definition.
   */
  private getConnectionName(def: NamedQueryDef): string {
    const structRef = def.structRef;
    const source =
      typeof structRef === 'string'
        ? this.modelDef.contents[structRef]
        : structRef;
    if (!isSourceDef(source)) {
      throw new Error('Invalid source for query');
    }
    return source.connection;
  }

  /**
   * Get a BuildQuery by name.
   *
   * @param name Name of the query to retrieve.
   * @returns A BuildQuery for the named query.
   * @throws Error if the name does not refer to a named query.
   */
  getBuildQuery(name: string): BuildQuery {
    const query = this.modelDef.contents[name];
    if (query?.type === 'query') {
      const def = query as NamedQueryDef;
      return new BuildQuery(def, this.queryModel, this.resolveSource);
    }
    throw new Error(`'${name}' does not refer to a named query.`);
  }

  /**
   * Get all named queries in the model.
   *
   * @returns Array of BuildQuery instances for all named queries.
   */
  getNamedQueries(): BuildQuery[] {
    const queries: BuildQuery[] = [];
    for (const [, obj] of Object.entries(this.modelDef.contents)) {
      if (obj?.type === 'query') {
        const def = obj as NamedQueryDef;
        queries.push(new BuildQuery(def, this.queryModel, this.resolveSource));
      }
    }
    return queries;
  }

  /**
   * Check if a query has the #@ persist annotation.
   */
  private isPersist(q: BuildQuery): boolean {
    const parsed = q.tagParse({prefix: /^#@ /});
    return parsed.tag.has('persist');
  }

  /**
   * Get all queries marked with #@ persist annotation.
   *
   * @returns Array of BuildQuery instances for queries with persist annotation.
   */
  getPersistQueries(): BuildQuery[] {
    const allQueries = this.getNamedQueries();
    return allQueries.filter(q => this.isPersist(q));
  }

  /**
   * Get the build graphs for all #@ persist queries.
   *
   * Each graph is a leveled array where queries in the same level can be
   * built in parallel, and levels must be built sequentially.
   *
   * @returns Array of BuildGraphs, one for each disjoint dependency tree.
   */
  async getBuildGraphs(): Promise<BuildGraph[]> {
    // 1. Get persist query names
    const persistQueries = this.getPersistQueries();
    const persistQueryNames = persistQueries.map(q => q.name);

    if (persistQueryNames.length === 0) {
      return [];
    }

    // 2. Build internal graph (sync, model layer)
    const internalGraph = buildInternalGraph(persistQueryNames, this.modelDef);

    // 3. Compute digests (async - needs connection lookup)
    const digestMap = this.queryModel.persistedQueryDigests;
    for (const level of internalGraph) {
      for (const node of level) {
        const buildQuery = this.getBuildQuery(node.name);
        const sql = buildQuery.compileQuery().sql;
        const connectionName = buildQuery.connectionName;
        const connection =
          await this.connections.lookupConnection(connectionName);
        digestMap[node.name] = makeDigest(connection.getDigest(), sql);
      }
    }

    // 4. Find leaf nodes (queries not depended upon by any other persist query)
    const dependedUpon = new Set<string>();
    for (const level of internalGraph) {
      for (const node of level) {
        for (const dep of node.dependsOn) {
          dependedUpon.add(dep);
        }
      }
    }

    // 5. Filter to only leaf nodes and convert to BuildGraph
    const leafNodes: BuildNode[] = [];
    for (const level of internalGraph) {
      for (const node of level) {
        if (!dependedUpon.has(node.name)) {
          leafNodes.push({
            id: {
              name: node.name,
              queryDigest: digestMap[node.name],
            },
            dependsOn: node.dependsOn.map(dep => ({
              name: dep,
              queryDigest: digestMap[dep],
            })),
          });
        }
      }
    }

    // Return minimal build graph (single level with all leaf nodes)
    return [leafNodes.length > 0 ? [leafNodes] : []];
  }

  /**
   * Get the computed query digests (name → digest map).
   * Must be called after getBuildGraphs() which computes the digests.
   *
   * @returns Map from query name to digest
   */
  getQueryDigests(): Record<string, string> {
    return this.queryModel.persistedQueryDigests;
  }
}
