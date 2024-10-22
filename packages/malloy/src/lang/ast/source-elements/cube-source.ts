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
    // TODO think about params for cube sources and test that this works...
    /**
     * source: foo(a is 1) is cube(
     *   duckdb.table('foo') extend { dimension: x is a },
     *   duckdb.table('bar') extend { dimension: x is a }
     * )
     */
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
            e: undefined,
          };
          fields.push(cubeField);
        }
      }
    });
    return {
      type: 'cube',
      // TODO for sources that are refs, actually use the ref rather than the def
      sources: sourceDefs,
      connection,
      fields,
      dialect,
      name,
    };
  }
}
