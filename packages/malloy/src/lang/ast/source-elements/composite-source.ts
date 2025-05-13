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
  SourceDef,
} from '../../../model/malloy_types';
import {isAtomic, isJoined, isSourceDef} from '../../../model/malloy_types';

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
        } else {
          joinsToCompose.set(fieldName, {
            sources: [field],
            join: field.join,
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
        } else if (field.accessModifier === 'internal') {
          existing.accessModifier = 'internal';
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
      // matrixOperation?: MatrixOperation;
      onExpression: undefined,
      onCompositeFieldUsage: [],
      // accessModifier?: NonDefaultAccessModifierLabel | undefined;
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
