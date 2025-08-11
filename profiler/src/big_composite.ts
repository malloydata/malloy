/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-console */
import type * as Malloy from '@malloydata/malloy-interfaces';
import {API} from '@malloydata/malloy';

function _getAllCombinations<T>(current: T[], remaining: T[], result: T[][]) {
  if (remaining.length === 0) {
    if (current.length > 0) {
      result.push(current);
    }
    return;
  }
  _getAllCombinations([...current, remaining[0]], remaining.slice(1), result);
  _getAllCombinations(current, remaining.slice(1), result);
}

function getAllCombinations<T>(items: T[]): T[][] {
  const result: T[][] = [];
  _getAllCombinations([], items, result);
  return result;
}

export function generateBigComposite() {
  const dimensionCount = 3;
  const preaggregateCount = 50;
  const dimensions: Malloy.FieldInfo[] = [];
  for (let i = 0; i < dimensionCount; i++) {
    dimensions.push({
      kind: 'dimension',
      name: `dim_${i}`,
      type: {kind: 'string_type'},
    });
  }
  const dimensionNames = dimensions.map(f => f.name);
  const preaggregates: Malloy.FieldInfo[] = [];
  for (let i = 0; i < preaggregateCount; i++) {
    preaggregates.push({
      kind: 'dimension',
      name: `preaggregate_${i}`,
      type: {kind: 'number_type', subtype: 'decimal'},
    });
  }
  const partitionField: Malloy.FieldInfo = {
    kind: 'dimension',
    name: 'partition_name',
    type: {kind: 'string_type'},
  };
  const schema: Malloy.Schema = {
    fields: [...dimensions, ...preaggregates, partitionField],
  };
  const tableName = 'cube';
  const connectionName = 'connection';
  let code = `
    ##! experimental { composite_sources access_modifiers }
  `;
  const slices = getAllCombinations(dimensionNames);
  const sliceNames: string[] = [];
  for (const slice of slices) {
    const partitionName = slice.join('.');
    const sliceName = `cube:${partitionName}`;
    sliceNames.push(sliceName);
    code += `
source: \`${sliceName}\` is ${connectionName}.table('${tableName}') include {
  public: ${slice.join(', ')}
  internal: ${partitionField.name}
  internal: ${preaggregates.map(a => a.name).join(',')}
} extend {
  where: ${partitionField.name} = '${partitionName}'
}

`;
  }

  code += `
source: cube is compose(
${sliceNames.map(n => `  \`${n}\``).join(',\n')}
) include {
  public: *
  internal: ${preaggregates.map(a => a.name).join(',')}
  internal: ${partitionField.name}
} extend {
  measure:
${preaggregates.map(a => `    total_${a.name} is ${a.name}.sum()`).join('\n')}
}

// Some extensions of the cube to bulk up the size...

source: cube_ext_1 is cube
source: cube_ext_2 is cube
source: cube_ext_3 is cube
source: cube_ext_4 is cube
source: cube_ext_5 is cube
`;

  const fileName = 'file://big_composite.malloy';

  const compileModelResponse = API.stateless.compileModel({
    model_url: fileName,
    compiler_needs: {
      files: [
        {
          url: fileName,
          contents: code,
        },
      ],
      connections: [
        {
          name: connectionName,
          dialect: 'duckdb',
        },
      ],
      table_schemas: [
        {
          name: tableName,
          connection_name: connectionName,
          schema,
        },
      ],
    },
    // exclude_references: true,
  });

  const compileQueryRequest: Malloy.CompileQueryRequest = {
    model_url: fileName,
    query: {
      definition: {
        kind: 'arrow',
        source: {
          kind: 'source_reference',
          name: 'cube',
        },
        view: {
          kind: 'segment',
          operations: [
            {
              kind: 'group_by',
              field: {
                expression: {
                  kind: 'field_reference',
                  name: dimensions[0].name,
                },
              },
            },
            {
              kind: 'aggregate',
              field: {
                expression: {
                  kind: 'field_reference',
                  name: `total_${preaggregates[0].name}`,
                },
              },
            },
          ],
        },
      },
    },
    compiler_needs: {
      translations: compileModelResponse.translations,
    },
  };

  return {
    code,
    schema,
    dimensions,
    preaggregates,
    partitionField,
    compileQueryRequest,
  };
}

console.log(JSON.stringify(generateBigComposite().compileQueryRequest));
