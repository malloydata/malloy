/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {Tag} from '../../tags';
import {Annotation, QueryToMaterialize} from '../malloy_types';
import {generateHash} from '../utils';

export function shouldMaterialize(annotation?: Annotation): boolean {
  const clonedAnnotation = structuredClone(annotation);

  if (clonedAnnotation) {
    clonedAnnotation.inherits = undefined;
  }

  const sourceTag = Tag.annotationToTag(clonedAnnotation).tag;

  return sourceTag.has('materialize');
}

export function buildQueryMaterializationSpec(
  path?: string,
  queryName?: string
): QueryToMaterialize {
  if (!queryName) {
    throw new Error(
      `Query tagged to materialize, but its name is not specified. ${path}`
    );
  }

  if (!path) {
    throw new Error(
      `Query tagged to materialize, but its path is not specified: ${queryName}`
    );
  }

  // Creating an object that should uniquely identify a query within a Malloy model repo.
  const queryRep = {
    path: path,
    source: undefined,
    queryName,
  };

  const objectHash = generateHash(JSON.stringify(queryRep));
  const id = `${queryName}-${objectHash}`;
  return {
    ...queryRep,
    id,
  };
}
