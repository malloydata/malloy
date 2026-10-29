import * as Malloy from '@malloydata/malloy-interfaces';
import {valueToMalloy} from '../util';
import type {Cell, RecordCell} from './cells';
import type {DrillEntry, DrillValue} from './types';
import type {ArrayField, RecordField} from './fields';

export function canDrill(cell: Cell): boolean {
  let current: Cell | undefined = cell;
  while (current) {
    const field = current.field;
    if (field.isArray()) {
      if (!(field as ArrayField).isDrillable) {
        return false;
      }
    }
    current = current.parent;
  }
  return true;
}

export function getStableDrillQuery(cell: Cell): Malloy.Query | undefined {
  const drillClauses = getStableDrillClauses(cell);
  if (drillClauses === undefined) return undefined;
  const drillOperations: Malloy.ViewOperationWithDrill[] = drillClauses.map(
    d => ({
      kind: 'drill',
      ...d,
    })
  );
  const root = cell.field.root();
  return {
    definition: {
      kind: 'arrow',
      source: {
        kind: 'source_reference',
        name: root.sourceName,
        parameters: root.sourceArguments,
      },
      view: {
        kind: 'segment',
        operations: [...drillOperations],
      },
    },
  };
}

export function getStableDrillClauses(
  cell: Cell
): Malloy.DrillOperation[] | undefined {
  let current: Cell | undefined = cell;
  const result: Malloy.DrillOperation[] = [];
  while (current) {
    const {field} = current;
    if (field.isArray()) {
      const filters = field.stableDrillFilters;
      if (filters === undefined) return undefined;
      // TODO handle filters in views that did not come from a view
      result.unshift(
        ...filters.map(f => ({
          kind: 'drill',
          filter: f,
        }))
      );
    }
    if (field.isRecord()) {
      const dimensions = (field as RecordField).fields.filter(
        f => f.isBasic() && f.wasDimension()
      );
      const newClauses: Malloy.DrillOperation[] = [];
      for (const dimension of dimensions) {
        const dimensionCell = (current as RecordCell).column(dimension.name);
        const value = dimensionCell.literalValue;
        if (value === undefined) {
          continue;
        }
        const drillExpression = dimension.drillStableExpression;
        if (drillExpression === undefined) {
          return undefined;
        }
        const filter: Malloy.FilterWithLiteralEquality = {
          kind: 'literal_equality',
          expression: drillExpression,
          value,
        };
        newClauses.push({filter});
      }
      result.unshift(...newClauses);
    }
    current = current.parent;
  }
  return result;
}

export function getDrillValues(cell: Cell): DrillValue[] {
  let current: Cell | undefined = cell;
  const result: DrillValue[] = [];
  while (current) {
    const field = current.field;
    if (field.isArray()) {
      const filters = field.drillFilters;
      result.unshift(...filters.map(f => ({where: f})));
    }
    if (field.isRecord()) {
      const dimensions = (field as RecordField).fields.filter(
        f => f.isBasic() && f.wasDimension()
      );
      const newClauses: DrillValue[] = [];
      for (const dimension of dimensions) {
        const dimensionCell = (current as RecordCell).column(dimension.name);
        const value = dimensionCell.literalValue;
        if (value === undefined) {
          continue;
        }
        const drillExpression = dimension.drillStableExpression;

        if (drillExpression !== undefined) {
          const filter: Malloy.FilterWithLiteralEquality = {
            kind: 'literal_equality',
            expression: drillExpression,
            value,
          };
          newClauses.push({where: Malloy.filterToMalloy(filter)});
        } else {
          const expression = dimension.drillExpression();
          newClauses.push({
            where: `${expression} = ${valueToMalloy(dimensionCell)}`,
          });
        }
      }
      result.unshift(...newClauses);
    }
    current = current.parent;
  }
  return result;
}

export function getDrillExpressions(cell: Cell): string[] {
  const drillValues = getDrillValues(cell);
  return drillValues.map(drill => {
    if ('where' in drill) return drill.where;
    const valueStr = valueToMalloy(drill.value);
    return `${drill.field.drillExpression()} = ${valueStr}`;
  });
}

export function getDrillEntries(cell: Cell): DrillEntry[] {
  const drillValues = getDrillValues(cell);
  const result: DrillEntry[] = [];
  for (const drill of drillValues) {
    if ('where' in drill) result.push(drill);
    else if (
      drill.value.isNull() ||
      drill.value.isTime() ||
      drill.value.isString() ||
      drill.value.isNumber() ||
      drill.value.isBoolean()
    ) {
      result.push({field: drill.field, value: drill.value.value});
    }
  }
  return result;
}

export function getStableDrillQueryMalloy(cell: Cell): string | undefined {
  if (getStableDrillClauses(cell)?.length === 0) {
    return `run: ${cell.field.root().sourceName} -> { select: * }`;
  }
  const query = getStableDrillQuery(cell);
  if (query === undefined) return undefined;
  return Malloy.queryToMalloy(query) + ' + { select: * }';
}

export function getDrillQueryMalloy(cell: Cell): string {
  const stableMalloy = getStableDrillQueryMalloy(cell);
  if (stableMalloy !== undefined) return stableMalloy;
  const expressions = getDrillExpressions(cell);
  let query = `run: ${cell.field.root().sourceName} ->`;
  if (expressions.length > 0) {
    query += ` {
  drill:
${expressions.map(entry => `    ${entry}`).join(',\n')}
} +`;
  }
  query += ' { select: * }';
  return query;
}
