/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import type {Dialect} from '../../../dialect';
import {
  hasCompositesAnywhere,
  resolveCompositeSources,
  logCompositeError,
  getExpandedSegment,
} from '../../composite-source-utils';
import type {
  AccessModifierLabel,
  AtomicFieldDef,
  Expr,
  FieldDef,
  QueryFieldDef,
  RefToField,
  TurtleDef,
} from '../../../model/malloy_types';
import {
  isAtomic,
  isIndexSegment,
  isJoined,
  isQuerySegment,
  isTemporalType,
  isTurtle,
  mkTemporal,
  type PipeSegment,
  type Query,
  type SourceDef,
} from '../../../model/malloy_types';
import {exprMapDeep} from '../../../model/utils';
import {ErrorFactory} from '../error-factory';
import {ColumnSpaceField} from '../field-space/column-space-field';
import {IRViewField} from '../field-space/ir-view-field';
import {
  StaticSourceSpace,
  StaticSpace,
  StructSpaceField,
} from '../field-space/static-space';
import {detectAndRemovePartialStages} from '../query-utils';
import type {
  FieldSpace,
  QueryFieldSpace,
  SourceFieldSpace,
} from '../types/field-space';
import {FieldName} from '../types/field-space';
import type {LookupResult} from '../types/lookup-result';
import {MalloyElement} from '../types/malloy-element';
import type {QueryComp} from '../types/query-comp';
import type {SpaceEntry} from '../types/space-entry';
import {SpaceField} from '../types/space-field';

class ExtendedFieldSpace implements SourceFieldSpace {
  readonly type = 'fieldSpace';
  private readonly extensionSpace: FieldSpace;
  constructor(
    readonly realFS: SourceFieldSpace,
    readonly sourceExtensions: FieldDef[]
  ) {
    const dialect = this.realFS.dialectName();
    const connection = this.realFS.connectionName();
    this.extensionSpace = new StaticSpace(
      {
        // TODO not actually a query_result...
        type: 'query_result',
        fields: sourceExtensions,
        name: 'extension',
        connection,
        dialect,
      },
      dialect,
      connection
    );
  }

  defToSpaceField(from: FieldDef): SpaceField {
    if (isJoined(from)) {
      return new StructSpaceField(
        from,
        this.realFS.dialectName(),
        this.realFS.connectionName()
      );
    } else if (isTurtle(from)) {
      return new IRViewField(this, from);
    }
    return new ColumnSpaceField(from);
  }

  structDef(): SourceDef {
    const base = this.realFS.structDef();
    return {
      ...base,
      fields: [...base.fields, ...this.sourceExtensions],
    };
  }

  emptyStructDef(): SourceDef {
    return this.realFS.emptyStructDef();
  }

  entry(name: string): SpaceEntry | undefined {
    return this.extensionSpace.entry(name) ?? this.realFS.entry(name);
  }

  lookup(
    symbol: FieldName[],
    accessLevel?: AccessModifierLabel | undefined,
    logReferences?: boolean
  ): LookupResult {
    const extensionResult = this.extensionSpace.lookup(
      symbol,
      accessLevel,
      logReferences
    );
    if (extensionResult.found) {
      return extensionResult;
    }
    return this.realFS.lookup(symbol, accessLevel, logReferences);
  }

  entries(): [string, SpaceEntry][] {
    return this.realFS.entries();
  }

  dialectName() {
    return this.realFS.dialectName();
  }

  dialectObj(): Dialect | undefined {
    return this.realFS.dialectObj();
  }

  isQueryFieldSpace(): this is QueryFieldSpace {
    return this.realFS.isQueryFieldSpace();
  }

  outputSpace() {
    if (this.realFS.isQueryFieldSpace()) {
      return this.realFS.outputSpace();
    }
    throw new Error('Not a query field space');
  }

  inputSpace() {
    if (this.realFS.isQueryFieldSpace()) {
      return this.realFS.inputSpace();
    }
    throw new Error('Not a query field space');
  }

  accessProtectionLevel(): AccessModifierLabel {
    return this.realFS.accessProtectionLevel();
  }

  connectionName(): string {
    return this.realFS.connectionName();
  }
}

export abstract class QueryBase extends MalloyElement {
  abstract queryComp(isRefOk: boolean): QueryComp;

  protected expandFieldUsage(
    inputSource: SourceDef,
    pipeline: PipeSegment[]
  ): PipeSegment[] {
    const ret: PipeSegment[] = [];
    let stageInput = inputSource;

    for (const segment of pipeline) {
      const newSegment = getExpandedSegment(segment, stageInput);
      ret.push(newSegment);
      // Get the output struct for the next stage
      stageInput = newSegment.outputStruct || ErrorFactory.structDef;
    }

    return ret;
  }

  protected resolveCompositeSource(
    inputSource: SourceDef,
    pipeline: PipeSegment[]
  ): SourceDef | undefined {
    const stage1 = pipeline[0];
    if (stage1 === undefined) return undefined;
    // TODO some features don't work with composite sources; e.g. sources in `extend:` don't
    // play nicely; here, we skip all the composite checking if there are no composites,
    // which hides the fact that this code doesn't handle sources in `extend:`.
    if (
      (isQuerySegment(stage1) || isIndexSegment(stage1)) &&
      hasCompositesAnywhere(inputSource)
    ) {
      const resolved = resolveCompositeSources(inputSource, stage1);
      if (resolved.error) {
        logCompositeError(resolved.error, this);
      }
      return resolved.sourceDef;
    }
    return undefined;
  }

  protected fullyResolveToFieldDef(
    field: QueryFieldDef,
    fs: SourceFieldSpace,
    joinPath: string[] = [],
    referenceIdMap: ReferenceIdMap
  ): AtomicFieldDef | TurtleDef {
    if (field.type === 'fieldref') {
      const path = [...joinPath, ...field.path].map(n => new FieldName(n));
      this.has({path});
      const lookup = fs.lookup(path, 'private', false);
      if (lookup.found && lookup.found instanceof SpaceField) {
        const referenceId = referenceIdMap.getReferenceId(lookup.found);
        const def = lookup.found.fieldDef();
        if (def && !isAtomic(def)) {
          return ErrorFactory.atomicFieldDef;
        }
        if (def !== undefined) {
          if (def.e) {
            const resolved = this.fullyResolveToFieldDef(
              def,
              fs,
              [...joinPath, ...field.path.slice(0, -1)],
              referenceIdMap
            );
            return {
              ...resolved,
              referenceId,
            };
          } else {
            const columnNode: Expr = {
              node: 'column',
              path: [...joinPath, ...field.path],
            };
            if (isTemporalType(def.type)) {
              return {
                ...def,
                referenceId,
                e: mkTemporal(columnNode, def.type),
              };
            }
            return {
              ...def,
              referenceId,
              e: columnNode,
            };
          }
        }
      }
      throw new Error(
        `Expected a definition for ${field.path.join(
          '.'
        )} when resolving references in query`
      );
    } else if (field.type === 'turtle') {
      return {
        ...field,
        pipeline: this.resolvePipelineReferencesForNest(
          field.pipeline,
          fs,
          referenceIdMap
        ),
      };
    } else if (isJoined(field)) {
      return field;
    } else {
      const mapExpr = (e: Expr) => {
        if (e.node === 'field') {
          const def = this.fullyResolveToFieldDef(
            {type: 'fieldref', path: e.path},
            fs,
            joinPath,
            referenceIdMap
          );
          if (!isAtomic(def)) {
            throw new Error(
              'Non-atomic field included in expression definition'
            );
          }
          // If there is an e, return it; otherwise, return node which says "this is a column"
          if (def.e === undefined) {
            throw new Error('Expected e to be defined now');
          }
          return def.e;
        } else if (e.node === 'aggregate' || e.node === 'function_call') {
          const structPath = [...joinPath, ...(e.structPath ?? [])];
          return {
            ...e,
            structPath: structPath.length > 0 ? structPath : undefined,
          };
        }
        return e;
      };
      const newE: Expr = field.e
        ? exprMapDeep(field.e, mapExpr)
        : {node: 'column', path: [...joinPath, field.name]};
      return {
        ...field,
        e: isTemporalType(field.type) ? mkTemporal(newE, field.type) : newE,
      };
    }
  }

  protected resolveReferencesInField(
    field: RefToField,
    fs: SourceFieldSpace,
    referenceIdMap: ReferenceIdMap
  ): RefToField;
  protected resolveReferencesInField(
    field: QueryFieldDef,
    fs: SourceFieldSpace,
    referenceIdMap: ReferenceIdMap
  ): QueryFieldDef;
  protected resolveReferencesInField(
    field: QueryFieldDef,
    fs: SourceFieldSpace,
    referenceIdMap: ReferenceIdMap
  ): QueryFieldDef {
    const resolved = this.fullyResolveToFieldDef(field, fs, [], referenceIdMap);
    return resolved;
  }

  protected resolveReferences(
    segment: PipeSegment,
    inputFS: SourceFieldSpace,
    referenceIdMap: ReferenceIdMap
  ): PipeSegment {
    const sourceExtensions = isQuerySegment(segment)
      ? segment.extendSource
      : undefined;
    const fs = sourceExtensions
      ? new ExtendedFieldSpace(inputFS, sourceExtensions)
      : inputFS;
    if (isIndexSegment(segment)) {
      return {
        ...segment,
        indexFields: segment.indexFields.map(f =>
          this.resolveReferencesInField(f, fs, referenceIdMap)
        ),
      };
    } else if (isQuerySegment(segment)) {
      return {
        ...segment,
        queryFields: segment.queryFields.map(f =>
          this.resolveReferencesInField(f, fs, referenceIdMap)
        ),
      };
    } else {
      return segment;
    }
  }

  // TODO this should really be merged with resolvePipelineReferences
  protected resolvePipelineReferencesForNest(
    pipeline: PipeSegment[],
    fs: SourceFieldSpace,
    referenceIdMap: ReferenceIdMap
  ) {
    const out: PipeSegment[] = [];
    for (let i = 0; i < pipeline.length; i++) {
      const segment = pipeline[i];
      const inputFS =
        i === 0
          ? fs
          : new StaticSourceSpace(pipeline[i - 1].outputStruct, 'public');
      const outSegment = this.resolveReferences(
        segment,
        inputFS,
        referenceIdMap
      );
      out.push(outSegment);
    }
    return out;
  }

  protected resolvePipelineReferences(
    pipeline: PipeSegment[],
    inputStruct: SourceDef
  ) {
    const referenceIdMap = new ReferenceIdMap();
    const out: PipeSegment[] = [];
    for (let i = 0; i < pipeline.length; i++) {
      const input = i === 0 ? inputStruct : pipeline[i - 1].outputStruct;
      const segment = pipeline[i];
      const inputFS = new StaticSourceSpace(input, 'public');
      const outSegment = this.resolveReferences(
        segment,
        inputFS,
        referenceIdMap
      );
      out.push(outSegment);
    }
    return out;
  }

  // protected resolveQueryReferences(query: Query, inputStruct: SourceDef) {
  //   const pipeline: PipeSegment[] = [];
  //   for (let i = 0; i < query.pipeline.length; i++) {
  //     const input = i === 0 ? inputStruct : query.pipeline[i - 1].outputStruct;
  //     const segment = query.pipeline[i];
  //     const outSegment = this.resolveReferences(segment, input);
  //     pipeline.push(outSegment);
  //   }
  //   return {...query, pipeline};
  // }

  query(): Query {
    const {query} = this.queryComp(true);

    return {
      ...query,
      pipeline: detectAndRemovePartialStages(query.pipeline, this),
    };
  }
}

class ReferenceIdMap {
  private map: Map<SpaceEntry, string> = new Map();

  getReferenceId(entry: SpaceEntry): string {
    const existing = this.map.get(entry);
    if (existing !== undefined) {
      return existing;
    } else {
      const referenceId = `ref${this.map.size}`;
      this.map.set(entry, referenceId);
      return referenceId;
    }
  }
}
