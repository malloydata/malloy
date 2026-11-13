/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  Annotations,
  API,
  expressionIsAggregate,
  expressionIsAnalytic,
  isJoined,
  isSourceDef,
  modelDefToModelInfo,
} from '@malloydata/malloy';
import type {FieldDef, ModelDef, StructDef} from '@malloydata/malloy';
import {maybeQuoteIdentifier} from '@malloydata/malloy-interfaces';
import type * as Malloy from '@malloydata/malloy-interfaces';

/**
 * What an interactive host shows about a model: every source and named
 * query it can see, with descriptions, and every field reachable from each
 * source, through joins and nested data, with how a query uses it.
 */
export interface Catalog {
  entries: CatalogEntry[];
}

export interface CatalogEntry {
  kind: 'source' | 'query';
  name: string;
  /** From `#"` annotations (Malloy's description route), or `#(docs)`. */
  description?: string;
  primary_key?: string;
  /** Source-level `where:` filters, as written. */
  filters: string[];
  /** Source parameters, as `name :: type`. */
  parameters: string[];
  /** Every field, the source's own first, then each join's, depth first. */
  fields: CatalogField[];
}

export interface CatalogField {
  /** The field's path, as a query writes it: `carriers.nickname`. */
  path: string;
  kind: 'dimension' | 'measure' | 'calculation' | 'view' | 'join';
  /** `string`, `number`, `string[]`, `{name :: string}[]`, `join_one`, `join_many`, `join_cross`, `view`. */
  type: string;
  /**
   * The path whose rows this field has one value per: empty for the
   * source's own rows, otherwise the nearest `join_many`, `join_cross` or
   * array on the way to it. Grouping by a field with a grain gives a row
   * per row of the grain, and aggregates of it run over that grain's rows.
   */
  grain: string;
  description?: string;
  /** The Malloy expression that defines it, if it isn't a column. */
  definition?: string;
  /** How a query uses it, in a sentence. */
  usage: string;
  /**
   * Clauses that use it, each valid inside `run: <source> -> { ... }` as
   * written: `group_by: carriers.nickname`, `aggregate: n is flights.count()`.
   */
  examples: string[];
}

/** How deep to follow joins of joins. */
const MAX_JOIN_DEPTH = 4;

function description(annotations: unknown): string | undefined {
  const notes = new Annotations(annotations as never);
  for (const route of ['"', 'docs']) {
    const text = notes
      .forRoute(route)
      .map(n => n.content.trim())
      .filter(t => t)
      .join('\n');
    if (text) return text;
  }
  return undefined;
}

function nameOf(field: {name: string; as?: string}): string {
  return field.as ?? field.name;
}

// Backquotes a name if Malloy needs it to be: unusual characters, or a
// reserved word (`hours`, `year`, `cast`...).
const quoteName = maybeQuoteIdentifier;

function join(path: string, name: string): string {
  return path ? `${path}.${quoteName(name)}` : quoteName(name);
}

// The IR's atomic and struct types are many; only what a type name needs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Def = any;

function typeName(def: Def): string {
  switch (def.type) {
    case 'sql native':
      return def.rawType ? `sql native (${def.rawType})` : 'sql native';
    case 'array':
      if (def.elementTypeDef?.type === 'record_element') {
        return `${recordTypeName(def.fields)}[]`;
      }
      return `${typeName(def.elementTypeDef ?? {type: 'sql native'})}[]`;
    case 'record':
    case 'record_element':
      return recordTypeName(def.fields);
    default:
      return String(def.type);
  }
}

function recordTypeName(fields: Def[] | undefined): string {
  const parts = (fields ?? []).map(f => `${nameOf(f)} :: ${typeName(f)}`);
  return `{${parts.join(', ')}}`;
}

function isPublic(field: FieldDef): boolean {
  return (field as Def).accessModifier === undefined;
}

class Walker {
  readonly fields: CatalogField[] = [];

  constructor(readonly sourceName: string) {}

  walk(struct: StructDef, path: string, grain: string, depth: number) {
    // The struct's own fields first, then each join's, so a source's fields
    // read before its joins' fields.
    const joins: Def[] = [];
    for (const field of struct.fields) {
      if (!isPublic(field)) continue;
      const def = field as Def;
      const fieldPath = join(path, nameOf(def));
      if (def.type === 'turtle') {
        this.view(def, fieldPath, path, grain);
      } else if (isJoined(def)) {
        this.joinField(def, fieldPath, grain);
        joins.push(def);
      } else {
        this.atomic(def, fieldPath, path, grain);
      }
    }
    for (const def of joins) {
      const fieldPath = join(path, nameOf(def));
      const fans = def.join !== 'one';
      if (isPlainArray(def)) {
        // A plain array's element is `each` (`value` is the same).
        const each = def.fields.find((f: Def) => f.name === 'each');
        if (each) {
          this.fields.push({
            path: `${fieldPath}.each`,
            kind: 'dimension',
            type: typeName(each),
            grain: fieldPath,
            usage: `One value per element of ${fieldPath}; ${fieldPath}.value is the same`,
            examples: [`group_by: ${fieldPath}.each`],
          });
        }
        continue;
      }
      if (depth < MAX_JOIN_DEPTH) {
        this.walk(def, fieldPath, fans ? fieldPath : grain, depth + 1);
      }
    }
  }

  private atomic(def: Def, path: string, parent: string, grain: string) {
    const kind = expressionIsAnalytic(def.expressionType)
      ? 'calculation'
      : expressionIsAggregate(def.expressionType)
        ? 'measure'
        : 'dimension';
    const type = typeName(def);
    this.fields.push({
      path,
      kind,
      type,
      grain,
      description: description(def.annotations),
      definition: def.code,
      ...usage(kind, type, path, parent, grain),
    });
  }

  private view(def: Def, path: string, parent: string, grain: string) {
    this.fields.push({
      path,
      kind: 'view',
      type: 'view',
      grain,
      description: description(def.annotations),
      usage: parent
        ? `A view of ${parent}`
        : `A query of ${quoteName(this.sourceName)}: run: ${quoteName(this.sourceName)} -> ${path}, or nest it`,
      examples: parent ? [] : [`nest: ${path}`],
    });
  }

  private joinField(def: Def, path: string, grain: string) {
    const column = firstField(def, () => true);
    const number = firstField(def, f => f.type === 'number');
    const measure = (def.fields as Def[]).find(
      f =>
        isPublic(f) && !isJoined(f) && expressionIsAggregate(f.expressionType)
    );
    const of = grain ? `${grain} row` : `${quoteName(this.sourceName)} row`;
    if (def.type === 'array' || def.type === 'record') {
      const many = def.type === 'array';
      const element = isPlainArray(def)
        ? `${path}.each`
        : column && join(path, nameOf(column));
      this.fields.push({
        path,
        kind: 'dimension',
        type: typeName(def),
        grain,
        description: description(def.annotations),
        usage: many
          ? `Nested data, many elements per ${of}: grouping by an element field gives a row per element; ${path}.count() counts elements`
          : `Nested data, one per ${of}: its fields are ${path}.<field>`,
        examples: [
          ...(element ? [`group_by: ${element}`] : []),
          ...(many ? [`aggregate: n is ${path}.count()`] : []),
        ],
      });
      return;
    }
    const relationship = String(def.join);
    const many = relationship !== 'one';
    this.fields.push({
      path,
      kind: 'join',
      type: `join_${relationship}`,
      grain,
      description: description(def.annotations),
      usage: many
        ? `Many ${path} per ${of}: grouping by a ${path} field gives a row per ${path}; aggregates of ${path} fields run over ${path} rows, each counted once`
        : `One ${path} per ${of}: its fields are ${path}.<field>; aggregates of them run over ${path} rows, each counted once`,
      examples: [
        ...(many ? [`aggregate: n is ${path}.count()`] : []),
        ...(column ? [`group_by: ${join(path, nameOf(column))}`] : []),
        ...(number
          ? [`aggregate: total is ${join(path, nameOf(number))}.sum()`]
          : []),
        ...(measure ? [`aggregate: ${join(path, nameOf(measure))}`] : []),
      ],
    });
  }
}

function isPlainArray(def: Def): boolean {
  return def.type === 'array' && def.elementTypeDef?.type !== 'record_element';
}

/** The first public column-like field of a struct matching `test`. */
function firstField(struct: Def, test: (f: Def) => boolean): Def | undefined {
  return (struct.fields as Def[]).find(
    f =>
      isPublic(f) &&
      f.type !== 'turtle' &&
      !isJoined(f) &&
      !expressionIsAggregate(f.expressionType) &&
      !expressionIsAnalytic(f.expressionType) &&
      test(f)
  );
}

function usage(
  kind: string,
  type: string,
  path: string,
  parent: string,
  grain: string
): {usage: string; examples: string[]} {
  // Grouping fans out only through a join_many, join_cross or array (the
  // grain); aggregating a joined field runs over the rows of the source it
  // comes from (the parent), each counted once.
  const over = parent ? `, over ${parent} rows, each counted once` : '';
  switch (kind) {
    case 'measure':
      return {
        usage: parent
          ? `A measure of ${parent}, computed over ${parent} rows, each counted once`
          : 'A measure',
        examples: [`aggregate: ${path}`],
      };
    case 'calculation':
      return {usage: 'A calculation (window function)', examples: []};
    default: {
      const per = grain ? `; grouping by it gives a row per ${grain}` : '';
      if (type === 'number') {
        return {
          usage: `A number${per}; .sum(), .avg(), .min() and .max() aggregate it${over}`,
          examples: [`group_by: ${path}`, `aggregate: total is ${path}.sum()`],
        };
      }
      return {
        usage: `A ${type}${per}; count(${path}) counts its distinct values`,
        examples: [`group_by: ${path}`, `aggregate: n is count(${path})`],
      };
    }
  }
}

function stableTypeName(type: Malloy.AtomicType): string {
  switch (type.kind) {
    case 'sql_native_type':
      return type.sql_type ? `sql native (${type.sql_type})` : 'sql native';
    case 'array_type':
      return `${stableTypeName(type.element_type)}[]`;
    case 'record_type':
      return `{${type.fields.map(f => `${f.name} :: ${stableTypeName(f.type)}`).join(', ')}}`;
    default:
      return type.kind.replace(/_type$/, '');
  }
}

/** Every source and named query in a compiled model, described. */
export function catalogOf(modelDef: ModelDef): Catalog {
  const entries: CatalogEntry[] = [];
  // Named queries' output schemas come from the stable conversion.
  const stable = modelDefToModelInfo({
    ...modelDef,
    exports: Object.keys(modelDef.contents),
  });
  const queryFields = new Map<string, Malloy.FieldInfo[]>();
  for (const entry of stable.entries) {
    queryFields.set(entry.name, entry.schema.fields);
  }
  for (const [name, def] of Object.entries(modelDef.contents)) {
    if (isSourceDef(def)) {
      const walker = new Walker(name);
      walker.walk(def, '', '', 0);
      const source = def as Def;
      entries.push({
        kind: 'source',
        name,
        description: description(source.annotations),
        primary_key: source.primaryKey,
        filters: (source.filterList ?? [])
          .map((f: Def) => f.code)
          .filter((c: unknown) => typeof c === 'string'),
        parameters: Object.values(source.parameters ?? {}).map(
          (p: Def) => `${p.name} :: ${typeName(p.value ?? p)}`
        ),
        fields: walker.fields,
      });
    } else if ((def as Def).type === 'query') {
      entries.push({
        kind: 'query',
        name,
        description: description((def as Def).annotations),
        filters: [],
        parameters: [],
        fields: (queryFields.get(name) ?? []).map(f => ({
          path: quoteName(f.name),
          kind:
            f.kind === 'join'
              ? 'join'
              : f.kind === 'view'
                ? 'view'
                : f.kind === 'calculate'
                  ? 'calculation'
                  : f.kind,
          type: 'type' in f ? stableTypeName(f.type) : f.kind,
          grain: '',
          usage: `A column of ${quoteName(name)}'s output`,
          examples: [],
        })) as CatalogField[],
      });
    }
  }
  return {entries};
}

/**
 * `compileModel`, answering with a {@link Catalog} of every source and named
 * query the model can see, imports included, once it compiles.
 */
export function compileModelCatalog(
  request: Malloy.CompileModelRequest
): Malloy.CompileModelResponse & {catalog?: Catalog} {
  const response = API.stateless.compileModel(request);
  const json = response.translations?.find(
    t => t.url === request.model_url
  )?.compiled_model_json;
  if (!response.model || json === undefined) {
    return response;
  }
  return {...response, catalog: catalogOf(JSON.parse(json) as ModelDef)};
}
