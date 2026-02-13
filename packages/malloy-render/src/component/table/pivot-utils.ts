/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Cell,
  Field,
  NestField,
  RecordOrRepeatedRecordCell,
  RecordOrRepeatedRecordField,
  SortableField,
} from '../../data_tree';

/**
 * Represents a unique combination of dimension values in a pivot.
 * Each PivotedField corresponds to one set of column headers.
 */
export type PivotedField = {
  /** JSON-stringified key for lookup (includes parent field name and dimension values) */
  key: string;
  /** The dimension cell values for this pivot combination */
  values: Cell[];
  /** The parent nested field being pivoted */
  parentField: RecordOrRepeatedRecordField;
  /** Number of non-dimension (measure) columns this spans */
  span: number;
  /** Map from dimension field name to cell value for quick lookup */
  fieldValueMap: Map<string, Cell>;
};

/**
 * Represents a single column in a pivoted table.
 * Combines a specific dimension value combination with a measure field.
 */
export type PivotedColumnField = {
  /** The pivot dimension combination */
  pivotedField: PivotedField;
  /** The actual measure field to render */
  field: Field;
  /** User-defined dimension fields (if specified) */
  userDefinedPivotDimensions?: string[];
};

// Re-export SortableField for convenience
export type {SortableField};

/**
 * Complete configuration for a pivot field.
 */
export type PivotConfig = {
  /** The nested field being pivoted */
  field: NestField;
  /** Dimension fields (used for column headers) */
  dimensions: SortableField[];
  /** Non-dimension fields (measures to display) */
  nonDimensions: SortableField[];
  /** All unique dimension value combinations, sorted */
  pivotedFields: PivotedField[];
  /** Expanded column list: pivotedFields * nonDimensions */
  columnFields: PivotedColumnField[];
  /** Max number of dimension levels (for header row depth) */
  pivotDepth: number;
};

/** Maximum number of pivot columns allowed */
export const PIVOT_COLUMN_LIMIT = 30;

/**
 * Creates a unique key for a pivot dimension combination.
 */
export function createPivotKey(
  parentField: RecordOrRepeatedRecordField,
  values: Cell[]
): string {
  return JSON.stringify({
    parentField: parentField.name,
    values: values.map(v => (v.field.isBasic() ? String(v.value) : '')),
  });
}

/**
 * Separates fields into dimensions and non-dimensions (measures).
 *
 * @param field The nested field being pivoted
 * @param userDimensions Optional explicit dimension field names
 * @returns Object with dimensions and nonDimensions arrays
 */
export function calculatePivotDimensions(
  field: NestField,
  userDimensions?: string[]
): {
  dimensions: SortableField[];
  nonDimensions: SortableField[];
} {
  const fieldsWithOrder = field.fieldsWithOrder;

  let dimensions: SortableField[];

  if (userDimensions && userDimensions.length > 0) {
    // Use explicitly specified dimensions
    dimensions = fieldsWithOrder.filter(
      f => userDimensions.indexOf(f.field.name) >= 0
    );

    // Validate all specified dimensions exist
    if (dimensions.length !== userDimensions.length) {
      for (const dim of userDimensions) {
        const found = fieldsWithOrder.find(f => f.field.name === dim);
        if (!found) {
          throw new Error(
            `Could not pivot ${field.name} since ${dim} is not a valid field.`
          );
        }
      }
    }
  } else {
    // Auto-detect dimensions: basic fields that were group_by (wasDimension)
    dimensions = fieldsWithOrder.filter(
      f => f.field.isBasic() && f.field.wasDimension()
    );
  }

  // Everything else is a non-dimension (measure)
  const dimensionNames = new Set(dimensions.map(d => d.field.name));
  const nonDimensions = fieldsWithOrder.filter(
    f => !dimensionNames.has(f.field.name)
  );

  if (nonDimensions.length === 0) {
    throw new Error(
      `Cannot pivot ${field.name} since all of its fields are dimensions.`
    );
  }

  return {dimensions, nonDimensions};
}

/**
 * Collects all unique dimension value combinations across all rows of data.
 *
 * @param field The nested field being pivoted
 * @param data The parent table data
 * @param dimensions The dimension fields to extract values from
 * @returns Map of pivot keys to PivotedField objects
 */
export function collectPivotedFields(
  field: NestField,
  data: RecordOrRepeatedRecordCell,
  dimensions: SortableField[],
  nonDimensionCount: number
): Map<string, PivotedField> {
  const pivotedFields = new Map<string, PivotedField>();

  for (const row of data.rows) {
    const nestedCell = row.column(field.name);

    if (nestedCell.isNull()) {
      continue;
    }

    if (!nestedCell.isRecordOrRepeatedRecord()) {
      throw new Error(`Cannot pivot field ${field.name}.`);
    }

    for (const innerRow of nestedCell.rows) {
      const dimensionValues = dimensions.map(d =>
        innerRow.column(d.field.name)
      );

      const pivotedField = createPivotedField(
        nestedCell.field,
        dimensionValues,
        nonDimensionCount
      );

      if (!pivotedFields.has(pivotedField.key)) {
        pivotedFields.set(pivotedField.key, pivotedField);
      }
    }
  }

  return pivotedFields;
}

/**
 * Creates a PivotedField from dimension values.
 */
function createPivotedField(
  parentField: RecordOrRepeatedRecordField,
  values: Cell[],
  span: number
): PivotedField {
  const key = createPivotKey(parentField, values);
  const fieldValueMap = new Map<string, Cell>();

  for (const value of values) {
    fieldValueMap.set(value.field.name, value);
  }

  return {
    key,
    values,
    parentField,
    span,
    fieldValueMap,
  };
}

/**
 * Sorts pivoted fields by their dimension values.
 * Uses Cell.compareTo() for type-appropriate sorting.
 *
 * @param pivotedFields Array of PivotedField objects
 * @param dimensions Dimension fields with sort direction
 * @returns Sorted array
 */
export function sortPivotedFields(
  pivotedFields: PivotedField[],
  dimensions: SortableField[]
): PivotedField[] {
  return [...pivotedFields].sort((a, b) => {
    for (const dim of dimensions) {
      const aValue = a.fieldValueMap.get(dim.field.name);
      const bValue = b.fieldValueMap.get(dim.field.name);

      if (
        aValue &&
        bValue &&
        aValue.field.isBasic() &&
        bValue.field.isBasic()
      ) {
        // Handle nulls
        if (aValue.isNull()) {
          if (bValue.isNull()) {
            continue;
          }
          return 1; // nulls sort last
        } else if (bValue.isNull()) {
          return -1;
        }

        // Use the cell's compareTo method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const compValue = aValue.compareTo(bValue as any);
        if (compValue !== 0) {
          // Default to 'asc' if dir is undefined
          return dim.dir === 'desc' ? -compValue : compValue;
        }
      }
    }
    return 0;
  });
}

/**
 * Expands sorted pivot fields into individual column fields.
 * Each pivot combination * each non-dimension = one column.
 *
 * @param pivotedFields Sorted array of PivotedField objects
 * @param nonDimensions Non-dimension (measure) fields
 * @param userDimensions Optional user-specified dimension names
 * @returns Array of PivotedColumnField objects
 */
export function expandPivotColumns(
  pivotedFields: PivotedField[],
  nonDimensions: SortableField[],
  userDimensions?: string[]
): PivotedColumnField[] {
  const columns: PivotedColumnField[] = [];

  for (const pf of pivotedFields) {
    for (const nonDim of nonDimensions) {
      columns.push({
        pivotedField: pf,
        field: nonDim.field,
        userDefinedPivotDimensions: userDimensions,
      });
    }
  }

  return columns;
}

/**
 * Builds a complete pivot configuration for a nested field.
 *
 * @param field The nested field with # pivot tag
 * @param data The parent table data
 * @param userDimensions Optional explicit dimension field names
 * @returns PivotConfig or null if pivot cannot be created
 */
export function buildPivotConfig(
  field: NestField,
  data: RecordOrRepeatedRecordCell,
  userDimensions?: string[]
): PivotConfig {
  const {dimensions, nonDimensions} = calculatePivotDimensions(
    field,
    userDimensions
  );

  const pivotedFieldsMap = collectPivotedFields(
    field,
    data,
    dimensions,
    nonDimensions.length
  );

  if (pivotedFieldsMap.size === 0) {
    throw new Error(`Could not pivot ${field.name}, no data found.`);
  }

  const sortedPivotedFields = sortPivotedFields(
    Array.from(pivotedFieldsMap.values()),
    dimensions
  );

  const columnFields = expandPivotColumns(
    sortedPivotedFields,
    nonDimensions,
    userDimensions
  );

  if (columnFields.length > PIVOT_COLUMN_LIMIT) {
    throw new Error(`Pivot limit of ${PIVOT_COLUMN_LIMIT} columns exceeded.`);
  }

  return {
    field,
    dimensions,
    nonDimensions,
    pivotedFields: sortedPivotedFields,
    columnFields,
    pivotDepth: dimensions.length,
  };
}

/**
 * Generates a map of pivot keys to cell values for a single row's nested data.
 * Used during rendering to look up the correct cell for each pivot column.
 *
 * @param nestedCell The nested record data for one row
 * @param pivotConfig The pivot configuration
 * @returns Map from pivot key to map of field name to cell
 */
export function generatePivotedCellsMap(
  nestedCell: RecordOrRepeatedRecordCell,
  pivotConfig: PivotConfig
): Map<string, Map<string, Cell>> {
  const result = new Map<string, Map<string, Cell>>();

  if (nestedCell.isNull()) {
    return result;
  }

  for (const row of nestedCell.rows) {
    const dimensionValues = pivotConfig.dimensions.map(d =>
      row.column(d.field.name)
    );

    const key = createPivotKey(nestedCell.field, dimensionValues);

    const cellsMap = new Map<string, Cell>();
    for (const nonDim of pivotConfig.nonDimensions) {
      cellsMap.set(nonDim.field.name, row.column(nonDim.field.name));
    }

    if (result.has(key)) {
      throw new Error(
        `Cannot pivot ${nestedCell.field.name}, dimensions lead to non-unique pivots.`
      );
    }

    result.set(key, cellsMap);
  }

  return result;
}

/**
 * Gets the pivot dimension values to display in a cell.
 * Used for rendering dimension value header cells.
 */
export function getPivotDimensionValue(
  pivotedField: PivotedField,
  dimensionIndex: number
): Cell | undefined {
  return pivotedField.values[dimensionIndex];
}

/**
 * Checks if a field should be rendered as a pivot table.
 * Syntax: # pivot
 */
export function shouldPivot(field: Field): boolean {
  return field.isNest() && field.tag.has('pivot');
}

/**
 * Gets user-defined pivot dimensions from the tag.
 * Syntax: # pivot { dimensions=[d1, d2] }
 */
export function getUserDefinedDimensions(field: Field): string[] | undefined {
  const dims = field.tag.textArray('pivot', 'dimensions');
  return dims && dims.length > 0 ? dims : undefined;
}
