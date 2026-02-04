/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Dialect} from '../dialect';
import type {StructDef, ResultStructMetadataDef} from './malloy_types';
import {indent, generateHash, getDialectFieldList} from './utils';

export class StageWriter {
  withs: string[] = [];
  stageNames: string[] = [];
  udfs: string[] = [];
  pdts: string[] = [];
  stagePrefix = '__stage';
  useCTE: boolean;
  stageNumber = 0;

  constructor(
    useCTE = true,
    public parent: StageWriter | undefined
  ) {
    this.useCTE = useCTE;
  }

  private nextName() {
    const stageName = `${this.stagePrefix}${this.root().stageNumber++}`;
    return stageName;
  }

  getName(id: number) {
    return this.stageNames[id];
  }

  root(): StageWriter {
    if (this.parent === undefined) {
      return this;
    } else {
      return this.parent.root();
    }
  }

  addStage(sql: string): string {
    if (this.useCTE) {
      this.withs.push(sql);
      const stageName = this.nextName();
      this.stageNames.push(stageName);
      return stageName;
    } else {
      this.withs[0] = sql;
      return indent(`\n(${sql})\n`);
    }
  }

  addUDF(
    stageWriter: StageWriter,
    dialect: Dialect,
    structDef: StructDef
  ): string {
    // eslint-disable-next-line prefer-const
    let {sql, lastStageName} = stageWriter.combineStages(true);
    if (lastStageName === undefined) {
      throw new Error('Internal Error: no stage to combine');
    }
    sql += dialect.sqlCreateFunctionCombineLastStage(
      lastStageName,
      getDialectFieldList(structDef),
      (structDef.resultMetadata as ResultStructMetadataDef)?.orderBy
    );

    const id = `${dialect.udfPrefix}${this.root().udfs.length}`;
    sql = dialect.sqlCreateFunction(id, sql);
    this.root().udfs.push(sql);
    return id;
  }

  addPDT(baseName: string, dialect: Dialect): string {
    const sql =
      this.combineStages(false).sql + this.withs[this.withs.length - 1];
    const name = baseName + generateHash(sql);
    const tableName = `scratch.${name}`;
    this.root().pdts.push(dialect.sqlCreateTableAsSelect(tableName, sql));
    return tableName;
  }

  // combine all the stages except the last one into a WITH statement
  //  return SQL and the last stage name
  combineStages(includeLastStage: boolean): {
    sql: string;
    lastStageName: string | undefined;
  } {
    if (!this.useCTE) {
      return {sql: this.withs[0], lastStageName: this.withs[0]};
    }
    let lastStageName = this.getName(0);
    let prefix = 'WITH ';
    let w = '';
    for (let i = 0; i < this.withs.length - (includeLastStage ? 0 : 1); i++) {
      const sql = this.withs[i];
      lastStageName = this.getName(i);
      if (sql === undefined) {
        throw new Error(
          `Expected sql WITH to be present for stage ${lastStageName}.`
        );
      }
      w += `${prefix}${lastStageName} AS (\n${indent(sql)})\n`;
      prefix = ', ';
    }
    return {sql: w, lastStageName};
  }

  /** emit the SQL for all the stages.  */
  generateSQLStages(): string {
    const lastStageNum = this.withs.length - 1;
    if (lastStageNum < 0) {
      throw new Error('No SQL generated');
    }
    const udfs = this.udfs.join('\n');
    const pdts = this.pdts.join('\n');
    const sql = this.useCTE ? this.combineStages(false).sql : '';
    return udfs + pdts + sql + this.withs[lastStageNum];
  }

  generateCoorelatedSubQuery(dialect: Dialect, structDef: StructDef): string {
    if (!this.useCTE) {
      return dialect.sqlCreateFunctionCombineLastStage(
        `(${this.withs[0]})`,
        getDialectFieldList(structDef),
        (structDef.resultMetadata as ResultStructMetadataDef)?.orderBy
      );
    } else {
      return (
        this.combineStages(true).sql +
        dialect.sqlCreateFunctionCombineLastStage(
          this.getName(this.withs.length - 1),
          getDialectFieldList(structDef),
          (structDef.resultMetadata as ResultStructMetadataDef)?.orderBy
        )
      );
    }
  }
}
