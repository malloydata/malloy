/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {
  Annotation,
  AtomicFieldDef,
  FieldDef,
  isAtomic,
  SourceDef,
} from '../../../model/malloy_types';

import {HasParameter} from '../parameters/has-parameter';
import {Source} from './source';
import {ParameterSpace} from '../field-space/parameter-space';

/**
 * A Source that is a virtual union of the fields of other sources, choosing
 * the first source that has all the fields at query time.
 */
export class CubeSource extends Source {
  elementType = 'cubeSource';
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
    const sourceDefs = this.sources.map(source =>
      source.withParameters(parameterSpace, pList)
    );
    const connection = sourceDefs[0].connection;
    const dialect = sourceDefs[0].dialect;
    const name = 'cube_source';
    const fields: FieldDef[] = [];
    const fieldNames = new Set<string>();
    this.sources.forEach((source, index) => {
      const sourceDef = sourceDefs[index];
      // Check that connections all match; don't bother checking dialect, since it will
      // match if the connection matches.
      if (sourceDef.connection !== connection) {
        source.logError(
          'cube-source-connection-mismatch',
          `All sources in a cube source must share the same connection; connection \`${sourceDef.connection}\` differs from previous connection \`${connection}\``
        );
      }
      for (const field of sourceDef.fields) {
        if (!isAtomic(field)) {
          source.logWarning(
            'cube-source-atomic-only',
            `Only atomic fields are supported in cube sources; field \`${field.name}\` is not atomic and will be ignored`
          );
          continue;
        }
        const fieldName = field.as ?? field.name;
        if (!fieldNames.has(fieldName)) {
          fieldNames.add(fieldName);
          const cubeField: AtomicFieldDef = {
            ...field,
            name: fieldName,
            as: undefined,
            e: {node: 'cubeField'},
            cubeUsage: {fields: [fieldName], joinedUsage: {}},
            code: this.code,
            location: this.codeLocation,
          };
          fields.push(cubeField);
        }
      }
    });
    return {
      type: 'cube',
      // TODO Use sourceRefs rather than sourceDefs when possible to avoid potential
      // explosion of source defs...
      sources: sourceDefs,
      connection,
      fields,
      dialect,
      name,
      parameters: sourceDefs[0].parameters,
    };
  }
}
