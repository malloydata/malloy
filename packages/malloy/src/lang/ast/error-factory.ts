/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/*
 ** For times when there is a code generation error but your function needs
 ** to return some kind of object to type properly, the ErrorFactory is
 ** here to help you.
 */

import type {
  TableSourceDef,
  IndexSegment,
  ProjectSegment,
  Query,
  ReduceSegment,
  StructDef,
  JoinFieldDef,
} from '../../model/malloy_types';

const ERR_NAME = '~malformed~';

export class ErrorFactory {
  static get structDef(): TableSourceDef {
    return {
      type: 'table',
      name: ERR_NAME,
      dialect: '~malformed~',
      connection: '~unknown~',
      tablePath: '//undefined_error_table_path',
      fields: [],
      errorFactory: true,
    };
  }

  static get joinDef(): JoinFieldDef {
    return {
      type: 'table',
      name: ERR_NAME,
      dialect: '~malformed~',
      connection: '~unknown~',
      tablePath: '//undefined_error_table_path',
      fields: [],
      join: 'one',
      matrixOperation: 'left',
      errorFactory: true,
    };
  }

  static didCreate(s: StructDef | JoinFieldDef): boolean {
    return s.errorFactory === true;
  }

  static get query(): Query {
    return {
      structRef: ErrorFactory.structDef,
      pipeline: [],
    };
  }

  static get reduceSegment(): ReduceSegment {
    return {
      type: 'reduce',
      queryFields: [],
      outputStruct: ErrorFactory.structDef,
      isRepeated: false,
    };
  }

  static get projectSegment(): ProjectSegment {
    return {
      type: 'project',
      queryFields: [],
      outputStruct: ErrorFactory.structDef,
      isRepeated: true,
    };
  }

  static get indexSegment(): IndexSegment {
    return {
      type: 'index',
      indexFields: [],
      outputStruct: ErrorFactory.structDef,
    };
  }
}
