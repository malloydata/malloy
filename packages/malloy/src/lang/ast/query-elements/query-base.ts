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

import {
  hasCompositesAnywhere,
  emptyFieldUsage,
  resolveCompositeSources,
  logCompositeError,
} from '../../../model/composite_source_utils';
import type {
  AtomicFieldDef,
  Expr,
  QueryFieldDef,
  RefToField,
  TurtleDef,
} from '../../../model/malloy_types';
import {
  isAtomic,
  isIndexSegment,
  isJoined,
  isQuerySegment,
  type PipeSegment,
  type Query,
  type SourceDef,
} from '../../../model/malloy_types';
import {exprMapDeep} from '../../../model/utils';
import {ErrorFactory} from '../error-factory';
import {StaticSourceSpace} from '../field-space/static-space';
import {detectAndRemovePartialStages} from '../query-utils';
import {FieldName, type FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import type {QueryComp} from '../types/query-comp';
import {SpaceField} from '../types/space-field';

export abstract class QueryBase extends MalloyElement {
  abstract queryComp(isRefOk: boolean): QueryComp;

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
      const fieldUsage = stage1.fieldUsage ?? emptyFieldUsage();
      const resolved = resolveCompositeSources(inputSource, stage1, fieldUsage);
      if (resolved.error) {
        logCompositeError(resolved.error, this);
      }
      return resolved.sourceDef;
    }
    return undefined;
  }

  protected fullyResolveToFieldDef(
    field: QueryFieldDef,
    fs: FieldSpace,
    joinPath: string[] = []
  ): AtomicFieldDef | TurtleDef {
    if (field.type === 'fieldref') {
      const path = [...joinPath, ...field.path].map(n => new FieldName(n));
      this.has({path});
      const lookup = fs.lookup(path, 'private', false);
      if (lookup.found && lookup.found instanceof SpaceField) {
        const def = lookup.found.fieldDef();
        if (def && !isAtomic(def)) {
          return ErrorFactory.atomicFieldDef;
        }
        if (def !== undefined) {
          if (def.e) {
            return this.fullyResolveToFieldDef(def, fs, [
              ...joinPath,
              ...field.path.slice(0, -1),
            ]);
          } else {
            return {
              ...def,
              e: {node: 'column', path: [...joinPath, ...field.path]},
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
      // TODO resolve references in the nest....
      return field;
    } else if (isJoined(field)) {
      return field;
    } else {
      const mapExpr = (e: Expr) => {
        if (e.node === 'field') {
          const def = this.fullyResolveToFieldDef(
            {type: 'fieldref', path: e.path},
            fs,
            joinPath
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
      return {
        ...field,
        e: field.e
          ? exprMapDeep(field.e, mapExpr)
          : {node: 'column', path: [...joinPath, field.name]},
      };
    }
  }

  protected resolveReferencesInField(
    field: RefToField,
    fs: FieldSpace
  ): RefToField;
  protected resolveReferencesInField(
    field: QueryFieldDef,
    fs: FieldSpace
  ): QueryFieldDef;
  protected resolveReferencesInField(
    field: QueryFieldDef,
    fs: FieldSpace
  ): QueryFieldDef {
    const resolved = this.fullyResolveToFieldDef(field, fs);
    return resolved;
  }

  protected resolveReferences(
    segment: PipeSegment,
    inputSource: SourceDef
  ): PipeSegment {
    const sourceExtensions = isQuerySegment(segment)
      ? segment.extendSource ?? []
      : [];
    const fs = new StaticSourceSpace(
      {
        ...inputSource,
        fields: [...inputSource.fields, ...sourceExtensions],
      },
      'public'
    );
    if (isIndexSegment(segment)) {
      return {
        ...segment,
        indexFields: segment.indexFields.map(f =>
          this.resolveReferencesInField(f, fs)
        ),
      };
    } else if (isQuerySegment(segment)) {
      return {
        ...segment,
        queryFields: segment.queryFields.map(f =>
          this.resolveReferencesInField(f, fs)
        ),
      };
    } else {
      return segment;
    }
  }

  protected resolvePipelineReferences(
    pipeline: PipeSegment[],
    inputStruct: SourceDef
  ) {
    const out: PipeSegment[] = [];
    for (let i = 0; i < pipeline.length; i++) {
      const input = i === 0 ? inputStruct : pipeline[i - 1].outputStruct;
      const segment = pipeline[i];
      const outSegment = this.resolveReferences(segment, input);
      out.push(outSegment);
    }
    return out;
  }

  protected resolveQueryReferences(query: Query, inputStruct: SourceDef) {
    const pipeline: PipeSegment[] = [];
    for (let i = 0; i < query.pipeline.length; i++) {
      const input = i === 0 ? inputStruct : query.pipeline[i - 1].outputStruct;
      const segment = query.pipeline[i];
      const outSegment = this.resolveReferences(segment, input);
      pipeline.push(outSegment);
    }
    return {...query, pipeline};
  }

  query(): Query {
    const {query} = this.queryComp(true);

    return {
      ...query,
      pipeline: detectAndRemovePartialStages(query.pipeline, this),
    };
  }
}
