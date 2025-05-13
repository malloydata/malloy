/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import type {
  Annotation,
  AtomicFieldDef,
  FieldDef,
  JoinFieldDef,
  JoinType,
  MatrixOperation,
  SourceDef,
} from '../../../model/malloy_types';
import {isAtomic, isJoined, isSourceDef, TD} from '../../../model/malloy_types';

import type {HasParameter} from '../parameters/has-parameter';
import {Source} from './source';
import type {ParameterSpace} from '../field-space/parameter-space';
import type {MalloyElement} from '../types/malloy-element';

/**
 * A Source that is a virtual union of the fields of other sources, choosing
 * the first source that has all the fields at query time.
 */
export class CompositeSource extends Source {
  elementType = 'compositeSource';
  currentAnnotation?: Annotation;

  constructor(readonly sources: Source[]) {
    super({sources});
  }

  getSourceDef(parameterSpace: ParameterSpace | undefined): SourceDef {
    return this.withParameters(parameterSpace, []);
  }

  withParameters(
    parameterSpace: ParameterSpace | undefined,
    pList: HasParameter[] | undefined
  ): SourceDef {
    const sourceDefs = this.sources.map(source => {
      return {
        sourceDef: source.withParameters(parameterSpace, pList),
        logTo: source,
      };
    });
    return composeSources(sourceDefs, this);
  }
}

function composeSources(
  sources: {
    sourceDef: SourceDef;
    logTo: MalloyElement;
  }[],
  compositeCodeSource: MalloyElement
): SourceDef {
  const connection = sources[0].sourceDef.connection;
  const dialect = sources[0].sourceDef.dialect;
  const name = 'composite_source';
  const fieldsByName = new Map<string, FieldDef>();
  const joinsToCompose = new Map<
    string,
    {
      sources: (JoinFieldDef & SourceDef)[];
      join: JoinType;
      matrixOperation?: MatrixOperation;
      accessModifier?: 'internal' | undefined;
    }
  >();
  sources.forEach(source => {
    const sourceDef = source.sourceDef;
    // Check that connections all match; don't bother checking dialect, since it will
    // match if the connection matches.
    if (sourceDef.connection !== connection) {
      source.logTo.logError(
        'composite-source-connection-mismatch',
        `All sources in a composite source must share the same connection; connection \`${sourceDef.connection}\` differs from previous connection \`${connection}\``
      );
    }
    for (const field of sourceDef.fields) {
      const fieldName = field.as ?? field.name;
      if (field.accessModifier === 'private') {
        continue;
      }
      /**
       * compose(flights -> {nest: by_carrier})
       *
       *
       *
       *
       */
      // does not handle compose(flights -> {nest: by_carrier})
      if (isJoined(field) && isSourceDef(field)) {
        const existingJoins = joinsToCompose.get(fieldName);
        if (existingJoins) {
          existingJoins.sources.push(field);
          if (field.join !== existingJoins.join) {
            source.logTo.logError(
              'composite-source-connection-mismatch',
              `Composited joins must have the same join type; \`${field.join}\` differs from previous type \`${existingJoins.join}\``
            );
          }
          if (field.matrixOperation !== existingJoins.matrixOperation) {
            source.logTo.logError(
              'composite-source-connection-mismatch',
              `Composited joins must have the same matrix operation; \`${field.matrixOperation}\` differs from previous operation \`${existingJoins.matrixOperation}\``
            );
          }
          if (field.accessModifier === 'internal') {
            existingJoins.accessModifier = 'internal';
          }
        } else {
          joinsToCompose.set(fieldName, {
            sources: [field],
            join: field.join,
            matrixOperation: field.matrixOperation,
            accessModifier: field.accessModifier,
          });
        }
        // TODO ensure that there isn't also a normal field with this name...
      } else if (isAtomic(field)) {
        const existing = fieldsByName.get(fieldName);
        if (existing === undefined) {
          const compositeField: AtomicFieldDef = {
            ...field,
            name: fieldName,
            as: undefined,
            e: {node: 'compositeField'},
            fieldUsage: [
              {path: [fieldName], at: compositeCodeSource.codeLocation},
            ],
            code: compositeCodeSource.code,
            location: compositeCodeSource.codeLocation,
            // A composite field's grouping may differ from slice to slice
            requiresGroupBy: undefined,
          };
          fieldsByName.set(fieldName, compositeField);
        } else {
          if (field.accessModifier === 'internal') {
            existing.accessModifier = 'internal';
          }
          if (
            !(
              TD.eq(field, existing) ||
              // Handle the case where both fields don't have a raw type...
              // TODO ask MToy about this
              (field.type === 'sql native' &&
                existing.type === 'sql native' &&
                field.rawType === existing.rawType)
            )
          ) {
            source.logTo.logError(
              'composite-field-type-mismatch',
              `field \`${
                field.name
              }\` must have the same type in all composite inputs: ${prettyType(
                field
              )} does not match ${prettyType(existing)}`
            );
          }
        }
      } else {
        source.logTo.logWarning(
          'composite-source-atomic-fields-only',
          `Only atomic fields are supported in composite sources; field \`${field.name}\` is not atomic and will be ignored`
        );
      }
      // TODO actually typecheck the existing field against the new field...
    }
  });
  for (const [joinName, sourcesInJoin] of joinsToCompose.entries()) {
    if (fieldsByName.has(joinName)) {
      compositeCodeSource.logError(
        'composite-field-type-mismatch',
        `field \`${joinName}\` must be a join in all sources or none`
      );
    }
    const composedSource = composeSources(
      sourcesInJoin.sources.map(s => ({
        sourceDef: s,
        logTo: compositeCodeSource,
      })),
      compositeCodeSource
    ) as SourceDef & JoinFieldDef;
    const compositeJoin = {
      ...composedSource,
      join: sourcesInJoin.join,
      name: joinName,
      matrixOperation: sourcesInJoin.matrixOperation,
      onExpression: undefined,
      onCompositeFieldUsage: [],
      accessModifier: sourcesInJoin.accessModifier,
    };
    fieldsByName.set(joinName, compositeJoin);
  }
  return {
    type: 'composite',
    // TODO Use sourceRefs rather than sourceDefs when possible to avoid potential
    // explosion of source defs...
    sources: sources.map(s => s.sourceDef),
    connection,
    fields: [...fieldsByName.values()],
    dialect,
    name,
    // TODO actually compose the parameters?
    parameters: sources[0].sourceDef.parameters,
  };
}

function prettyType(a: FieldDef): string {
  return `\`${a.type}\``;
}
