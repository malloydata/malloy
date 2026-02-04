/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  DocumentCompletion as DocumentCompletionDefinition,
  DocumentSymbol as DocumentSymbolDefinition,
  MalloyTranslator,
} from '../../lang';
import type {DocumentHelpContext} from '../../lang/parse-tree-walkers/document-help-context-walker';
import type {PathInfo} from '../../lang/parse-tree-walkers/find-table-path-walker';
import type {InvalidationKey} from '../../runtime_types';

/**
 * A parsed Malloy document.
 */
export class Parse {
  constructor(
    private translator: MalloyTranslator,
    private invalidationKey?: InvalidationKey
  ) {}

  /**
   * Retrieve the symbols defined in the parsed document.
   *
   * These symbols represent any object defined (e.g. `Query`s and `Explore`s)
   * in the document.
   *
   * @return An array of document symbols.
   */
  public get symbols(): DocumentSymbol[] {
    return (this.translator.metadata().symbols || []).map(
      symbol => new DocumentSymbol(symbol)
    );
  }

  /**
   * Retrieve the full table paths for tables defined in the parsed document.
   * Derived tables i.e. a table that extends another table, table from a query
   * are not included.
   *
   * @return An array of document table path info.
   */
  public get tablePathInfo(): DocumentTablePath[] {
    const paths: PathInfo[] = this.translator.tablePathInfo().pathInfo ?? [];
    return paths.map(path => new DocumentTablePath(path));
  }

  public get _translator(): MalloyTranslator {
    return this.translator;
  }

  public get _invalidationKey(): InvalidationKey | undefined {
    return this.invalidationKey;
  }

  public completions(position: {
    line: number;
    character: number;
  }): DocumentCompletion[] {
    return (this.translator.completions(position).completions || []).map(
      completion => new DocumentCompletion(completion)
    );
  }

  public helpContext(position: {
    line: number;
    character: number;
  }): DocumentHelpContext | undefined {
    return this.translator.helpContext(position).helpContext;
  }
}

/**
 * Path info for a table defined in a Malloy document.
 */
export class DocumentTablePath {
  private _range: DocumentRange;
  private _connectionId: string;
  private _tablePath: string;

  constructor(tablePath: PathInfo) {
    this._range = DocumentRange.fromJSON(tablePath.range);
    this._connectionId = tablePath.connectionId;
    this._tablePath = tablePath.tablePath;
  }

  /**
   * @return The range of characters in the source Malloy document that defines
   * this table.
   */
  public get range(): DocumentRange {
    return this._range;
  }

  /** @return The Connection Id for this table. */
  public get connectionId(): string {
    return this._connectionId;
  }

  /** @return The full table path. */
  public get tablePath(): string {
    return this._tablePath;
  }
}

/**
 * A range of characters within a Malloy document.
 */
export class DocumentRange {
  private _start: DocumentPosition;
  private _end: DocumentPosition;

  constructor(start: DocumentPosition, end: DocumentPosition) {
    this._start = start;
    this._end = end;
  }

  /**
   * @return The position of the first character in the range.
   */
  public get start(): DocumentPosition {
    return this._start;
  }

  /**
   * @return The position of the last character in the range.
   */
  public get end(): DocumentPosition {
    return this._end;
  }

  /**
   * @return This range in JSON format.
   */
  public toJSON(): {
    start: {line: number; character: number};
    end: {line: number; character: number};
  } {
    return {
      start: this.start.toJSON(),
      end: this.end.toJSON(),
    };
  }

  /**
   * Construct a DocumentRange from JSON.
   */
  public static fromJSON(json: {
    start: {line: number; character: number};
    end: {line: number; character: number};
  }): DocumentRange {
    return new DocumentRange(
      new DocumentPosition(json.start.line, json.start.character),
      new DocumentPosition(json.end.line, json.end.character)
    );
  }
}

/**
 * A position within a Malloy document.
 */
export class DocumentPosition {
  private _line: number;
  private _character: number;

  constructor(line: number, character: number) {
    this._line = line;
    this._character = character;
  }

  /**
   * @return The line number of the position.
   */
  public get line(): number {
    return this._line;
  }

  /**
   * @return The character index on the line `this.getLine()`.
   */
  public get character(): number {
    return this._character;
  }

  /**
   * @return This position in JSON format.
   */
  public toJSON(): {line: number; character: number} {
    return {line: this.line, character: this.character};
  }
}

/**
 * A symbol defined in a Malloy document.
 *
 * Represents any object defined (e.g. `Query`s and `Explore`s) in the document.
 */
export class DocumentSymbol {
  private _range: DocumentRange;
  private _lensRange: DocumentRange | undefined;
  private _type: string;
  private _name: string;
  private _children: DocumentSymbol[];

  constructor(documentSymbol: DocumentSymbolDefinition) {
    this._range = DocumentRange.fromJSON(documentSymbol.range);
    this._lensRange = documentSymbol.lensRange
      ? DocumentRange.fromJSON(documentSymbol.lensRange)
      : undefined;
    this._type = documentSymbol.type;
    this._name = documentSymbol.name;
    this._children = documentSymbol.children.map(
      child => new DocumentSymbol(child)
    );
  }

  /**
   * @return The range of characters in the source Malloy document that define this symbol.
   */
  public get range(): DocumentRange {
    return this._range;
  }

  /**
   * @return The range of characters in the source Malloy document that define this symbol,
   * including tags. Note: "block tags" are included if there is exactly one
   * definition in the block.
   */
  public get lensRange(): DocumentRange {
    return this._lensRange ?? this._range;
  }

  /**
   * @return The type of symbol.
   *
   * Possible values are: `"explore"`, `"query"`, `"field"`, `"turtle"`, `"join"`, or `"unnamed_query"`.
   */
  public get type(): string {
    return this._type;
  }

  /**
   * @return The name of this symbol, e.g. the `Explore` name or `Query` name.
   *
   * For type `"unnamed_query"`, `getName()` is `"unnamed_query"`.
   */
  public get name(): string {
    return this._name;
  }

  /**
   * @return An array of document symbols defined inside this document symbol,
   * e.g. fields in an `Explore`.
   */
  public get children(): DocumentSymbol[] {
    return this._children;
  }
}

export class DocumentCompletion {
  public readonly type: string;
  public readonly text: string;

  constructor(completion: DocumentCompletionDefinition) {
    this.type = completion.type;
    this.text = completion.text;
  }
}
