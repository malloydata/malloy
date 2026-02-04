/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryData, QueryDataRow, QueryValue} from '../../model';
import type {DataRecord} from './result';

// =============================================================================
// Types
// =============================================================================

export interface WriteStream {
  write: (text: string) => void;
  close: () => void;
}

// Represents a csv cell/table.
type CellMatrix = {
  rows: string[];
  length: number;
  width: number;
};

// =============================================================================
// DataWriter Base Class
// =============================================================================

export abstract class DataWriter {
  constructor(protected readonly stream: WriteStream) {}

  abstract process(data: AsyncIterableIterator<DataRecord>): Promise<void>;
}

// =============================================================================
// JSONWriter
// =============================================================================

export class JSONWriter extends DataWriter {
  async process(data: AsyncIterableIterator<DataRecord>): Promise<void> {
    this.stream.write('[\n');
    for await (const row of data) {
      if (row.index !== undefined && row.index > 0) {
        this.stream.write(',\n');
      }
      // toJSON() returns JSON-safe values: bigints as strings, dates as ISO strings
      const json = JSON.stringify(row.toJSON(), null, 2);
      const jsonLines = json.split('\n');
      for (let i = 0; i < jsonLines.length; i++) {
        const line = jsonLines[i];
        this.stream.write(`  ${line}`);
        if (i < jsonLines.length - 1) {
          this.stream.write('\n');
        }
      }
    }
    this.stream.write('\n]\n');
    this.stream.close();
  }
}

// =============================================================================
// CSVWriter
// =============================================================================

/**
 * CSV writer class that handles nested data.
 * This writer creates CSV using a DFS traversal of the result dataset.
 * Each trivial column value is converted to a CSV of 1x1 matrix and all the
 * columns are merged together to create a CSV that represents 1 QueryDataRow.
 * Since this follows DFS, each non trivial data is rendered into a NxM matrix
 * where N is the number of rows in the nested data and M is the number of
 * columns it has.
 * For any row with X number of columns, we end up with X number of NxM matrices
 * where the value of N,M pair may be different for each column.
 * We then merge the matrices so that we end up with a larger matrix of size
 * Max(N)xSum(M) by taking one row of csv from each matric at a time. For any
 * matrix with N<Max(N), we add a row of empty CSV cells of size N.
 */
export class CSVWriter extends DataWriter {
  private readonly columnSeparator = ',';
  private readonly rowSeparator = '\n';
  private readonly quoteCharacter = '"';
  private readonly includeHeader = true;
  private readonly emptyCell = '';

  private escape(value: string) {
    const hasInnerQuote = value.includes(this.quoteCharacter);
    const hasInnerCommas = value.includes(this.columnSeparator);
    const hasNewline = value.includes(this.rowSeparator);
    const needsQuoting = hasInnerCommas || hasInnerQuote || hasNewline;
    if (hasInnerQuote) {
      value = value.replace(
        new RegExp(this.quoteCharacter, 'g'),
        this.quoteCharacter + this.quoteCharacter
      );
    }

    if (needsQuoting) {
      value = this.quoteCharacter + value + this.quoteCharacter;
    }

    return value;
  }

  // Re-using the old stringify method for sanity.
  private stringify(value: QueryValue) {
    if (value === null) {
      return this.emptyCell;
    } else if (value instanceof Date) {
      return value.toISOString();
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      return JSON.stringify(value);
    } else if (typeof value === 'bigint') {
      // Bigints from toObject() - write as unquoted number string
      return value.toString();
    } else {
      return `${value}`;
    }
  }

  // Extra weight to be added becase of nested tables inside the cells.
  private getColWeight(jsonVal: QueryDataRow | QueryData) {
    let firstVal = jsonVal;
    if (Array.isArray(jsonVal)) {
      firstVal = jsonVal[0];
    }
    let numKeys = 0;
    for (const key in firstVal) {
      numKeys = numKeys + 1;
      const val = firstVal[key];
      if (Array.isArray(val)) {
        const weight = this.getColWeight(val) - 1;
        numKeys = numKeys + weight;
      }
    }
    return numKeys;
  }

  // Get header row along with extra empty spaces for nested children.
  private getHeaderRow(row: QueryDataRow): CellMatrix {
    const csv: string[] = [];
    let width = 0;
    for (const key in row) {
      csv.push(this.escape(key));
      const val = row[key];
      width++;
      if (Array.isArray(val)) {
        const numKeys = this.getColWeight(val) - 1;
        width = width + numKeys;
        for (let i = 0; i < numKeys; i++) {
          csv.push(this.emptyCell);
        }
      }
    }
    return {rows: [csv.join(this.columnSeparator)], length: 1, width: width};
  }

  // Merge the child matrices i.e. merge the columns into one bigger matrix i.e. CSV.
  private mergeMatrices(matrices: CellMatrix[]): CellMatrix {
    const maxLength = Math.max(...matrices.map(matrix => matrix.length));
    const matrixWidth = matrices.reduce((sum, matrix) => sum + matrix.width, 0);
    const csvMatrix: string[] = [];
    for (let i = 0; i < maxLength; i++) {
      const csvRow: string[] = [];
      for (const matrix of matrices) {
        if (i < matrix.length) {
          csvRow.push(matrix.rows[i]);
        } else {
          // Add empty cells.
          const emptyCells: string[] = Array(matrix.width).fill(this.emptyCell);
          csvRow.push(...emptyCells);
        }
      }
      csvMatrix.push(csvRow.join(this.columnSeparator));
    }
    return {
      rows: csvMatrix,
      length: maxLength,
      width: matrixWidth,
    };
  }

  // Gets CSV for a data cell that has nested data.
  private getChildMatrix(jsonVal: QueryData): CellMatrix {
    // This is not expected to happen.
    if (!Array.isArray(jsonVal)) {
      return {
        rows: ['Invalid data found, value is not an array'],
        length: 1,
        width: 1,
      };
    } else if (jsonVal.length === 0) {
      return {
        rows: [''],
        length: 1,
        width: 1,
      };
    }
    const csvMatrix: string[] = [];

    const header = this.getHeaderRow(jsonVal[0]);
    // Header has 1 row.
    csvMatrix.push(...header.rows);
    const width = header.width;
    let rowCount = 1;

    for (const row of jsonVal) {
      const rowMatrix = this.getRowMatrix(row);
      rowCount = rowCount + rowMatrix.length;
      csvMatrix.push(...rowMatrix.rows);
    }

    return {rows: csvMatrix, length: rowCount, width: width};
  }

  // Creates CSV content for one row of data.
  private getRowMatrix(row: QueryDataRow) {
    const matrices: CellMatrix[] = [];
    for (const key in row) {
      const val = row[key];
      if (!Array.isArray(val)) {
        const cell = {
          rows: [this.stringify(val)],
          length: 1,
          width: 1,
        };
        matrices.push(cell);
      } else {
        const cell = this.getChildMatrix(val);
        matrices.push(cell);
      }
    }
    return this.mergeMatrices(matrices);
  }

  async process(data: AsyncIterableIterator<DataRecord>): Promise<void> {
    let headerDefined = false;
    for await (const row of data) {
      if (!headerDefined && this.includeHeader) {
        const header: CellMatrix = this.getHeaderRow(row.toObject());
        this.stream.write(header.rows[0]);
        this.stream.write(this.rowSeparator);
        headerDefined = true;
      }
      const rowCsv = this.getRowMatrix(row.toObject());
      for (const line of rowCsv.rows) {
        this.stream.write(line);
        this.stream.write(this.rowSeparator);
      }
    }
    this.stream.close();
  }
}
