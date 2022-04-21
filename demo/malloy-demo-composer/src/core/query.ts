/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import {
  QuerySummary,
  QuerySummaryItem,
  StagePath,
  SchemaField,
  stagePathPop,
  StageSummary,
  OrderByField,
  QuerySummaryItemDataStyle,
  QuerySummaryItemFilter,
  stagePathParent,
} from "../types";
import { FilterExpression } from "@malloydata/malloy";
import {
  FieldDef,
  isFilteredAliasedName,
  PipeSegment,
  QueryFieldDef,
  StructDef,
  TurtleDef,
  FieldTypeDef,
} from "@malloydata/malloy";
import { DataStyles } from "@malloydata/render";
import { Segment as QuerySegment } from "@malloydata/malloy";
import { FilteredAliasedName } from "@malloydata/malloy/src/model";

class SourceUtils {
  constructor(protected source: StructDef) {}

  updateSource(source: StructDef) {
    this.source = source;
  }

  protected getField(source: StructDef, fieldName: string): FieldDef {
    let parts = fieldName.split(".");
    let currentSource = source;
    while (parts.length > 1) {
      const part = parts[0];
      const found = currentSource.fields.find((f) => (f.as || f.name) === part);
      if (found === undefined) {
        throw new Error(`Could not find (inner) ${part}`);
      }
      if (found.type === "struct") {
        currentSource = found;
        parts = parts.slice(1);
      } else if (found.type === "turtle") {
        let turtleSource = this.source;
        for (const stage of found.pipeline) {
          turtleSource = this.modifySourceForStage(stage, turtleSource);
        }
        currentSource = turtleSource;
        parts = parts.slice(1);
      } else {
        throw new Error("Inner segment in path is not a source");
      }
    }
    const found = currentSource.fields.find(
      (f) => (f.as || f.name) === parts[0]
    );
    if (found === undefined) {
      throw new Error(`Could not find ${parts[0]}`);
    }
    return found;
  }

  protected modifySourceForStage(
    stage: PipeSegment,
    source: StructDef
  ): StructDef {
    try {
      return QuerySegment.nextStructDef(source, stage);
    } catch (error) {
      return {
        name: "pipe_stage",
        type: "struct",
        fields: [],
        structSource: { type: "table" },
        structRelationship: { type: "basetable", connectionName: "foo" },
        dialect: source.dialect,
      };
    }
  }
}

export class QueryBuilder extends SourceUtils {
  private query: TurtleDef;
  constructor(source: StructDef) {
    super(source);
    this.query = {
      pipeline: [
        {
          type: "reduce",
          fields: [],
        },
      ],
      name: "new_query",
      type: "turtle",
    };
  }

  getName(): string {
    return this.query.name;
  }

  private stageAtPath(stagePath: StagePath) {
    let current = this.query.pipeline;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const {
        stagePath: newStagePath,
        stageIndex,
        fieldIndex,
      } = stagePathPop(stagePath);
      if (fieldIndex !== undefined) {
        const newField = current[stageIndex].fields[fieldIndex];
        if (
          typeof newField === "string" ||
          isFilteredAliasedName(newField) ||
          newField.type !== "turtle"
        ) {
          throw new Error("Path does not refer to a stage correctly");
        }
        current = newField.pipeline;
        if (newStagePath === undefined) {
          throw new Error("Invalid stage path");
        }
        stagePath = newStagePath;
      } else {
        return current[stageIndex];
      }
    }
  }

  private sourceForStageAtPath(stagePath: StagePath) {
    let currentPipeline = this.query.pipeline;
    let currentSource = this.source;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const {
        stagePath: newStagePath,
        stageIndex,
        fieldIndex,
      } = stagePathPop(stagePath);
      for (
        let currentStageIndex = 0;
        currentStageIndex < stageIndex;
        currentStageIndex++
      ) {
        currentSource = this.modifySourceForStage(
          currentPipeline[currentStageIndex],
          currentSource
        );
      }
      if (fieldIndex !== undefined) {
        const newField = currentPipeline[stageIndex].fields[fieldIndex];
        if (
          typeof newField === "string" ||
          isFilteredAliasedName(newField) ||
          newField.type !== "turtle"
        ) {
          throw new Error("Path does not refer to a stage correctly");
        }
        currentPipeline = newField.pipeline;
        if (newStagePath === undefined) {
          throw new Error("Invalid stage path");
        }
        stagePath = newStagePath;
      } else {
        return currentSource;
      }
    }
  }

  private sortOrder(field: FieldDef) {
    if (field.type === "struct") {
      return 3;
    } else if (field.type === "turtle") {
      return 2;
    } else if (field.aggregate) {
      return 1;
    } else {
      return 0;
    }
  }

  private fieldDefForQueryFieldDef(field: QueryFieldDef, source: StructDef) {
    if (typeof field === "string") {
      return this.getField(source, field);
    } else if (isFilteredAliasedName(field)) {
      return this.getField(source, field.name);
    } else {
      return field;
    }
  }

  private getIndexToInsertNewField(
    stagePath: StagePath,
    queryFieldDef: QueryFieldDef
  ) {
    const stage = this.stageAtPath(stagePath);
    const stageSource = this.sourceForStageAtPath(stagePath);
    const fieldDef = this.fieldDefForQueryFieldDef(queryFieldDef, stageSource);
    const sortOrder = this.sortOrder(fieldDef);
    for (let fieldIndex = 0; fieldIndex < stage.fields.length; fieldIndex++) {
      const existingField = stage.fields[fieldIndex];
      try {
        const existingFieldDef = this.fieldDefForQueryFieldDef(
          existingField,
          stageSource
        );
        const existingSortOrder = this.sortOrder(existingFieldDef);
        if (existingSortOrder > sortOrder) {
          return fieldIndex;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log(error);
      }
    }
    return stage.fields.length;
  }

  private insertField(stagePath: StagePath, field: QueryFieldDef) {
    const stage = this.stageAtPath(stagePath);
    const insertIndex = this.getIndexToInsertNewField(stagePath, field);
    stage.fields.splice(insertIndex, 0, field);
  }

  addField(stagePath: StagePath, fieldPath: string): void {
    this.insertField(stagePath, fieldPath);
  }

  loadQuery(queryPath: string): void {
    const definition = this.getField(this.source, queryPath);
    if (definition.type !== "turtle") {
      throw new Error("Path does not refer to query.");
    }
    definition.pipeline.forEach((stage, stageIndex) => {
      if (this.query.pipeline[stageIndex] === undefined) {
        this.query.pipeline[stageIndex] = JSON.parse(JSON.stringify(stage));
      } else {
        const existingStage = this.query.pipeline[stageIndex];
        if (existingStage.type !== "reduce" || stage.type !== "reduce") {
          throw new Error("Cannot load query with non-reduce stages");
        }
        if (stage.by) {
          existingStage.by = { ...stage.by };
          existingStage.orderBy = undefined;
        }
        if (stage.filterList) {
          existingStage.filterList = (existingStage.filterList || []).concat(
            ...stage.filterList.filter((filter) => {
              return !existingStage.filterList?.find(
                (existingFilter) => existingFilter.code === filter.code
              );
            })
          );
        }
        if (stage.limit) {
          existingStage.limit = stage.limit;
        }
        if (stage.orderBy) {
          existingStage.orderBy = stage.orderBy;
          existingStage.by = undefined;
        }
        existingStage.fields = stage.fields
          .map((field) => JSON.parse(JSON.stringify(field)))
          .concat(
            existingStage.fields.filter((field) => {
              return !stage.fields.find(
                (otherField) => this.nameOf(otherField) === this.nameOf(field)
              );
            })
          );
      }
    });
    this.query.name = definition.as || definition.name;
  }

  private nameOf(field: QueryFieldDef) {
    if (typeof field === "string") {
      return field;
    } else {
      return field.as || field.name;
    }
  }

  replaceSavedField(
    stagePath: StagePath,
    fieldIndex: number,
    name: string
  ): void {
    const stage = this.stageAtPath(stagePath);
    stage.fields.splice(fieldIndex, 1, name);
  }

  removeField(stagePath: StagePath, fieldIndex: number): void {
    const stage = this.stageAtPath(stagePath);
    if (stage.type === "reduce" && stage.orderBy) {
      const orderIndex = stage.orderBy.findIndex((order) => {
        const field = stage.fields[fieldIndex];
        return order.field === this.nameOf(field);
      });
      if (orderIndex !== -1) {
        stage.orderBy.splice(orderIndex, 1);
      }
    }
    stage.fields.splice(fieldIndex, 1);
  }

  getFieldIndex(stagePath: StagePath, fieldPath: string): number | undefined {
    const stage = this.stageAtPath(stagePath);
    const index = stage.fields.findIndex((f) => f === fieldPath);
    return index === -1 ? undefined : index;
  }

  hasField(stagePath: StagePath, fieldPath: string): boolean {
    return this.getFieldIndex(stagePath, fieldPath) !== undefined;
  }

  reorderFields(stagePath: StagePath, order: number[]): void {
    const stage = this.stageAtPath(stagePath);
    const newFields = order.map((index) => stage.fields[index]);
    stage.fields = newFields;
  }

  toggleField(stagePath: StagePath, fieldPath: string): void {
    const fieldIndex = this.getFieldIndex(stagePath, fieldPath);
    if (fieldIndex !== undefined) {
      this.removeField(stagePath, fieldIndex);
    } else {
      this.addField(stagePath, fieldPath);
    }
  }

  getQuery(): TurtleDef {
    return this.query;
  }

  addFilter(stagePath: StagePath, filter: FilterExpression): void {
    const stage = this.stageAtPath(stagePath);
    stage.filterList = [...(stage.filterList || []), filter];
  }

  editFilter(
    stagePath: StagePath,
    fieldIndex: number | undefined,
    filterIndex: number,
    filter: FilterExpression
  ): void {
    const stage = this.stageAtPath(stagePath);
    if (fieldIndex === undefined) {
      if (stage.filterList === undefined) {
        throw new Error("Stage has no filters.");
      }
      stage.filterList[filterIndex] = filter;
    } else {
      const field = stage.fields[fieldIndex];
      if (!isFilteredAliasedName(field)) {
        throw new Error("Cannot edit filter on non FAN.");
      }
      if (field.filterList === undefined) {
        throw new Error("Field has no filters");
      }
      field.filterList[filterIndex] = filter;
    }
  }

  removeFilter(
    stagePath: StagePath,
    filterIndex: number,
    fieldIndex?: number
  ): void {
    const stage = this.stageAtPath(stagePath);
    if (fieldIndex === undefined) {
      if (stage.filterList) {
        stage.filterList.splice(filterIndex, 1);
      }
    } else {
      const field = stage.fields[fieldIndex];
      if (isFilteredAliasedName(field)) {
        field.filterList?.splice(fieldIndex, 1);
      }
    }
  }

  hasLimit(stagePath: StagePath): boolean {
    const stage = this.stageAtPath(stagePath);
    if (stage.type !== "reduce") {
      throw new Error("Don't know how to handle this yet");
    }
    return stage.limit !== undefined;
  }

  addLimit(
    stagePath: StagePath,
    limit: number,
    byField?: SchemaField,
    direction?: "asc" | "desc"
  ): void {
    const stage = this.stageAtPath(stagePath);
    if (stage.type !== "reduce") {
      throw new Error("Don't know how to handle this yet");
    }
    stage.limit = limit;
    if (byField) {
      stage.orderBy = [
        {
          field: byField.path,
          dir: direction,
        },
      ];
    }
  }

  addOrderBy(
    stagePath: StagePath,
    byFieldIndex: number,
    direction?: "asc" | "desc"
  ): void {
    const stage = this.stageAtPath(stagePath);
    if (stage.type !== "reduce") {
      throw new Error("Don't know how to handle this yet");
    }
    stage.orderBy = stage.orderBy || [];
    const field = stage.fields[byFieldIndex];
    const name = typeof field === "string" ? field : field.as || field.name;
    stage.orderBy.push({
      field: name,
      dir: direction,
    });
  }

  editOrderBy(
    stagePath: StagePath,
    orderByIndex: number,
    direction: "asc" | "desc" | undefined
  ): void {
    const stage = this.stageAtPath(stagePath);
    if (stage.type !== "reduce") {
      throw new Error("Don't know how to handle this yet");
    }
    stage.orderBy = stage.orderBy || [];
    stage.orderBy[orderByIndex] = {
      field: stage.orderBy[orderByIndex].field,
      dir: direction,
    };
  }

  removeLimit(stagePath: StagePath): void {
    const stage = this.stageAtPath(stagePath);
    stage.limit = undefined;
  }

  addStage(stagePath: StagePath | undefined, fieldIndex?: number): void {
    let query;
    if (stagePath !== undefined) {
      const parentStage = this.stageAtPath(stagePath);
      if (fieldIndex === undefined) {
        throw new Error("fieldIndex must be provided if stagePath is");
      }
      const field = parentStage.fields[fieldIndex];
      if (
        typeof field !== "string" &&
        !isFilteredAliasedName(field) &&
        field.type === "turtle"
      ) {
        query = field;
      } else {
        throw new Error("Invalid field to add stage to.");
      }
    } else {
      query = this.query;
    }
    query.pipeline.push({
      type: "reduce",
      fields: [],
    });
  }

  removeStage(stagePath: StagePath): void {
    const {
      stagePath: parentStagePath,
      fieldIndex,
      stageIndex,
    } = stagePathParent(stagePath);
    let query;
    if (parentStagePath !== undefined) {
      const parentStage = this.stageAtPath(parentStagePath);
      if (fieldIndex === undefined) {
        throw new Error("Invalid stage path");
      }
      const field = parentStage.fields[fieldIndex];
      if (
        typeof field !== "string" &&
        !isFilteredAliasedName(field) &&
        field.type === "turtle"
      ) {
        query = field;
      } else {
        throw new Error("Invalid field to add stage to.");
      }
    } else {
      query = this.query;
    }
    query.pipeline.splice(stageIndex, 1);
    if (query.pipeline.length === 0) {
      query.pipeline.push({
        type: "reduce",
        fields: [],
      });
    }
  }

  removeOrderBy(stagePath: StagePath, orderingIndex: number): void {
    const stage = this.stageAtPath(stagePath);
    if (stage.type !== "reduce") {
      throw new Error("Don't know how to handle this yet");
    }
    if (stage.orderBy) {
      stage.orderBy.splice(orderingIndex, 1);
    }
  }

  canRun(): boolean {
    // TODO check that all nested stages can run, too
    return this.query.pipeline[0].fields.length > 0;
  }

  renameField(stagePath: StagePath, fieldIndex: number, as: string): void {
    const stage = this.stageAtPath(stagePath);
    if (stage.type !== "reduce") {
      throw new Error("Don't know how to handle this yet");
    }
    const field = stage.fields[fieldIndex];
    const fieldName = this.nameOf(field);
    // Rename references in order bys
    if (stage.orderBy) {
      stage.orderBy.forEach((order) => {
        if (order.field === fieldName) {
          order.field = as;
        }
      });
    }

    if (typeof field === "string") {
      stage.fields[fieldIndex] = { name: field, as };
    } else if (isFilteredAliasedName(field)) {
      field.as = as;
    } else {
      field.as = as;
    }
  }

  addFilterToField(
    stagePath: StagePath,
    fieldIndex: number,
    filter: FilterExpression,
    as?: string
  ): void {
    if (as !== undefined) {
      this.renameField(stagePath, fieldIndex, as);
    }
    const stage = this.stageAtPath(stagePath);
    if (stage.type !== "reduce") {
      throw new Error("Don't know how to handle this yet");
    }
    const field = stage.fields[fieldIndex];
    if (typeof field === "string") {
      if (as === undefined) {
        throw new Error(
          "As must be specified if field is not already renamed."
        );
      }
    } else if (isFilteredAliasedName(field)) {
      field.filterList = [...(field.filterList || []), filter];
    }
  }

  addNewNestedQuery(stagePath: StagePath, name: string): void {
    const newNestedQuery: QueryFieldDef = {
      name,
      type: "turtle",
      pipeline: [{ type: "reduce", fields: [] }],
    };
    this.insertField(stagePath, newNestedQuery);
  }

  addNewField(stagePath: StagePath, definition: QueryFieldDef): void {
    this.insertField(stagePath, definition);
  }

  editFieldDefinition(
    stagePath: StagePath,
    fieldIndex: number,
    definition: QueryFieldDef
  ): void {
    const stage = this.stageAtPath(stagePath);
    stage.fields[fieldIndex] = definition;
  }

  replaceWithDefinition(
    stagePath: StagePath,
    fieldIndex: number,
    structDef: StructDef
  ): void {
    const stage = this.stageAtPath(stagePath);
    const field = stage.fields[fieldIndex];
    if (typeof field !== "string") {
      throw new Error("Don't deal with this yet");
    }
    const definition = structDef.fields.find(
      (def) => (def.as || def.name) === field
    );
    // TODO handle case where definition is too complex...
    if (definition === undefined) {
      throw new Error("Field is not defined..");
    }
    stage.fields[fieldIndex] = JSON.parse(JSON.stringify(definition));
  }

  setName(name: string): void {
    this.query.name = name;
  }
}

export class QueryWriter extends SourceUtils {
  constructor(private readonly query: TurtleDef, source: StructDef) {
    super(source);
  }

  getQueryStringForSource(name: string): string {
    return this.getMalloyString(true, name);
  }

  getQueryStringForModel(): string {
    return this.getMalloyString(false, this.query.name);
  }

  private getFiltersString(filterList: FilterExpression[]): Fragment[] {
    const fragments = [];
    if (filterList.length === 1) {
      fragments.push(" ");
    } else {
      fragments.push(NEWLINE, INDENT);
    }
    for (let index = 0; index < filterList.length; index++) {
      const filter = filterList[index];
      fragments.push(filter.code);
      if (index !== filterList.length - 1) {
        fragments.push(",");
      }
      fragments.push(NEWLINE);
    }
    if (filterList.length > 1) {
      fragments.push(OUTDENT);
    }
    return fragments;
  }

  private codeInfoForField(
    field: QueryFieldDef,
    source: StructDef,
    indent: string
  ): { property: string; malloy: Fragment[] } | undefined {
    try {
      if (typeof field === "string") {
        const fieldDef = this.getField(source, field);
        if (fieldDef.type === "struct") {
          throw new Error("Don't know how to deal with this");
        }
        const property =
          fieldDef.type === "turtle"
            ? "nest"
            : fieldDef.aggregate
            ? "aggregate"
            : "group_by";
        return { property, malloy: [field] };
      } else if (isFilteredAliasedName(field)) {
        const fieldDef = this.getField(source, field.name);
        if (fieldDef.type === "struct") {
          throw new Error("Don't know how to deal with this");
        }
        const property =
          fieldDef.type === "turtle"
            ? "nest"
            : fieldDef.aggregate
            ? "aggregate"
            : "group_by";
        const malloy: Fragment[] = [];
        const newName = field.as === undefined ? "" : `${field.as} is `;
        malloy.push(`${newName}${field.name}`);
        if (field.filterList && field.filterList.length > 0) {
          malloy.push(" {", INDENT, "where:");
          malloy.push(...this.getFiltersString(field.filterList || []));
          malloy.push(OUTDENT, "}");
        }
        return { property, malloy };
      } else if (field.type === "turtle") {
        const malloy: Fragment[] = [];
        malloy.push(`${field.as || field.name} is`);
        let stageSource = source;
        let head = true;
        for (const stage of field.pipeline) {
          if (!head) {
            malloy.push("->");
          }
          malloy.push(
            ...this.getMalloyStringForStage(stage, stageSource, indent + "  ")
          );
          stageSource = this.modifySourceForStage(stage, stageSource);
          head = false;
        }
        return { property: "nest", malloy };
      } else {
        const property = field.aggregate ? "aggregate" : "group_by";
        const malloy: Fragment[] = [
          `${field.as || field.name} is ${field.code}`,
        ];
        return { property, malloy };
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(error);
    }
  }

  private writeMalloyForPropertyValues(
    property: string,
    malloys: Fragment[][]
  ): Fragment[] {
    if (malloys.length === 0) {
      return [];
    } else if (malloys.length === 1) {
      return [property, ": ", ...malloys[0], NEWLINE];
    } else {
      return [
        property,
        ": ",
        NEWLINE,
        INDENT,
        ...malloys.flatMap(
          (fragments) => [...fragments, NEWLINE] as Fragment[]
        ),
        OUTDENT,
      ];
    }
  }

  private getMalloyStringForStage(
    stage: PipeSegment,
    source: StructDef,
    indent = ""
  ): Fragment[] {
    const malloy: Fragment[] = [];
    malloy.push(" {", NEWLINE, INDENT);
    if (stage.filterList && stage.filterList.length > 0) {
      malloy.push("where:", ...this.getFiltersString(stage.filterList));
    }
    let currentProperty: string | undefined;
    let currentMalloys: Fragment[][] = [];
    for (const field of stage.fields) {
      const info = this.codeInfoForField(field, source, indent);
      if (info) {
        if (
          currentProperty !== undefined &&
          info.property !== currentProperty
        ) {
          malloy.push(
            ...this.writeMalloyForPropertyValues(
              currentProperty,
              currentMalloys
            )
          );
          currentMalloys = [];
        }
        currentProperty = info.property;
        currentMalloys.push(info.malloy);
      }
    }
    if (currentProperty) {
      malloy.push(
        ...this.writeMalloyForPropertyValues(currentProperty, currentMalloys)
      );
    }
    if (stage.limit) {
      malloy.push(`limit: ${stage.limit}`, NEWLINE);
    }
    if (stage.type === "reduce" && stage.orderBy && stage.orderBy.length > 0) {
      malloy.push("order_by: ");
      malloy.push(
        stage.orderBy
          .map((order) => {
            let name;
            if (typeof order.field === "string") {
              const names = order.field.split(".");
              name = names[names.length - 1];
            } else {
              name = order.field;
            }
            return `${name}${order.dir ? " " + order.dir : ""}`;
          })
          .join(", "),
        NEWLINE
      );
    }
    malloy.push(OUTDENT, "}");
    return malloy;
  }

  private getMalloyString(forSource: boolean, name?: string): string {
    const initParts = [];
    if (!forSource) {
      initParts.push("query:");
    }
    if (name !== undefined) {
      initParts.push(`${name} is`);
    }
    if (!forSource) {
      initParts.push(this.source.as || this.source.name);
    }
    const malloy: Fragment[] = [initParts.join(" ")];
    let stageSource = this.source;
    for (const stage of this.query.pipeline) {
      if (!forSource) {
        malloy.push(" ->");
      }
      malloy.push(...this.getMalloyStringForStage(stage, stageSource));
      stageSource = this.modifySourceForStage(stage, stageSource);
    }
    return codeFromFragments(malloy);
  }

  private getSummaryItemsForFilterList(
    filterList: FilterExpression[]
  ): QuerySummaryItemFilter[] {
    const items: QuerySummaryItemFilter[] = [];
    for (
      let filterIndex = 0;
      filterIndex < filterList.length || 0;
      filterIndex++
    ) {
      const filter = filterList[filterIndex];
      items.push({ type: "filter", filterSource: filter.code, filterIndex });
    }
    return items;
  }

  getQuerySummary(
    modelDataStyles: DataStyles,
    dataStyles: DataStyles
  ): QuerySummary {
    const queryName = this.query.name;
    let stageSource = this.source;
    const stages = this.query.pipeline.map((stage, index) => {
      const summary = this.getStageSummary(
        stage,
        stageSource,
        modelDataStyles,
        dataStyles
      );
      stageSource = this.modifySourceForStage(stage, stageSource);
      if (index === this.query.pipeline.length - 1) {
        const styleItem = this.getStyleItemForName(
          queryName,
          "query",
          modelDataStyles,
          dataStyles
        );
        if (styleItem) {
          summary.items.push(styleItem);
        }
      }
      return summary;
    });
    return { stages };
  }

  private nameOf(field: QueryFieldDef) {
    if (typeof field === "string") {
      return field;
    } else {
      return field.as || field.name;
    }
  }

  getStyleItem(
    field: QueryFieldDef,
    source: StructDef,
    modelDataStyles: DataStyles,
    dataStyles: DataStyles
  ): QuerySummaryItemDataStyle | undefined {
    let name: string;
    let kind: "dimension" | "measure" | "query" | "source";
    if (typeof field === "string") {
      name = field;
      const fieldDef = this.getField(source, field);
      if (fieldDef.type === "struct") {
        throw new Error("Don't know how to deal with this");
      }
      kind =
        fieldDef.type === "turtle"
          ? "query"
          : fieldDef.aggregate
          ? "measure"
          : "dimension";
    } else {
      name = field.as || field.name;
      if (isFilteredAliasedName(field)) {
        const fieldDef = this.getField(source, field.name);
        if (fieldDef.type === "struct") {
          throw new Error("Don't know how to deal with this");
        }
        kind =
          fieldDef.type === "turtle"
            ? "query"
            : fieldDef.aggregate
            ? "measure"
            : "dimension";
      } else {
        kind =
          field.type === "turtle"
            ? "query"
            : field.aggregate
            ? "measure"
            : "dimension";
      }
    }
    return this.getStyleItemForName(name, kind, modelDataStyles, dataStyles);
  }

  private getStyleItemForName(
    name: string,
    kind: string,
    modelDataStyles: DataStyles,
    dataStyles: DataStyles
  ): QuerySummaryItemDataStyle | undefined {
    const dataStyle = { ...modelDataStyles, ...dataStyles }[name];
    if (dataStyle === undefined || dataStyle.renderer === undefined) {
      return undefined;
    } else {
      return {
        type: "data_style",
        renderer: dataStyle.renderer,
        styleKey: name,
        canRemove: name in dataStyles,
        allowedRenderers:
          kind === "query" || kind === "source"
            ? [
                "table",
                "bar_chart",
                "dashboard",
                "json",
                "line_chart",
                "list",
                "list_detail",
                "point_map",
                "scatter_chart",
                "segment_map",
                "shape_map",
                "spark_line",
              ]
            : [
                "number",
                "boolean",
                "currency",
                "image",
                "link",
                "percent",
                "text",
                "time",
              ],
      };
    }
  }

  getStageSummary(
    stage: PipeSegment,
    source: StructDef,
    modelDataStyles: DataStyles,
    dataStyles: DataStyles
  ): StageSummary {
    const items: QuerySummaryItem[] = [];
    const orderByFields: OrderByField[] = [];
    if (stage.filterList) {
      items.push(...this.getSummaryItemsForFilterList(stage.filterList));
    }
    for (let fieldIndex = 0; fieldIndex < stage.fields.length; fieldIndex++) {
      const field = stage.fields[fieldIndex];
      try {
        const styleItem = this.getStyleItem(
          field,
          source,
          modelDataStyles,
          dataStyles
        );
        const styleItems = styleItem ? [styleItem] : [];
        if (typeof field === "string") {
          const fieldDef = this.getField(source, field);
          if (fieldDef.type === "struct") {
            throw new Error("Don't know how to deal with this");
          }
          items.push({
            type: "field",
            field: fieldDef,
            saveDefinition: undefined,
            fieldIndex,
            isRefined: false,
            styles: styleItems.filter((s) => s.canRemove),
            isRenamed: false,
            path: field,
            kind:
              fieldDef.type === "turtle"
                ? "query"
                : fieldDef.aggregate
                ? "measure"
                : "dimension",
            name: fieldDef.as || fieldDef.name,
          });
          if (fieldDef.type !== "turtle") {
            orderByFields.push({
              name: field,
              fieldIndex,
              type: fieldDef.type,
            });
          }
        } else if (isFilteredAliasedName(field)) {
          const fieldDef = this.getField(source, field.name);
          if (fieldDef.type === "struct") {
            throw new Error("Don't know how to deal with this");
          }
          if (fieldDef.type !== "turtle") {
            orderByFields.push({
              name: field.as || field.name,
              fieldIndex,
              type: fieldDef.type,
            });
          }
          items.push({
            type: "field",
            field: fieldDef,
            saveDefinition:
              source === this.source && fieldDef.type !== "turtle"
                ? this.fanToDef(field, fieldDef)
                : undefined,
            fieldIndex,
            filters: this.getSummaryItemsForFilterList(field.filterList || []),
            styles: styleItems.filter((s) => s.canRemove),
            isRefined: true,
            path: field.name,
            isRenamed: field.as !== undefined,
            name: field.as || field.name,
            kind:
              fieldDef.type === "turtle"
                ? "query"
                : fieldDef.aggregate
                ? "measure"
                : "dimension",
          });
        } else if (field.type === "turtle") {
          const stages = [];
          let stageSource = source;
          for (const stage of field.pipeline) {
            stages.push(
              this.getStageSummary(
                stage,
                stageSource,
                modelDataStyles,
                dataStyles
              )
            );
            stageSource = this.modifySourceForStage(stage, stageSource);
          }
          items.push({
            type: "nested_query_definition",
            name: field.as || field.name,
            fieldIndex,
            saveDefinition: source === this.source ? field : undefined,
            stages: stages,
            styles: styleItems,
          });
        } else {
          items.push({
            type: "field_definition",
            name: field.as || field.name,
            fieldIndex,
            saveDefinition: source === this.source ? field : undefined,
            source: field.code,
            kind: field.aggregate ? "measure" : "dimension",
            styles: styleItems,
          });
          orderByFields.push({
            name: field.as || field.name,
            fieldIndex,
            type: field.type,
          });
        }
      } catch (error) {
        items.push({
          type: "error_field",
          field,
          name: this.nameOf(field),
          error: error.message,
          fieldIndex,
        });
      }
    }
    if (stage.limit) {
      items.push({ type: "limit", limit: stage.limit });
    }
    if (stage.type === "reduce" && stage.orderBy) {
      for (
        let orderByIndex = 0;
        orderByIndex < stage.orderBy.length;
        orderByIndex++
      ) {
        const order = stage.orderBy[orderByIndex];
        let byFieldIndex;
        if (typeof order.field === "string") {
          byFieldIndex = stage.fields.findIndex(
            (f) => this.nameOf(f) === order.field
          );
        } else {
          byFieldIndex = order.field - 1;
        }
        const byFieldQueryDef = stage.fields[byFieldIndex];
        if (byFieldQueryDef !== undefined) {
          let theField;
          if (typeof byFieldQueryDef === "string") {
            theField = this.getField(source, byFieldQueryDef);
          } else if (isFilteredAliasedName(byFieldQueryDef)) {
            theField = this.getField(
              source,
              byFieldQueryDef.as || byFieldQueryDef.name
            );
          } else {
            theField = byFieldQueryDef;
          }
          if (theField.type === "struct" || theField.type === "turtle") {
            continue;
          }
          items.push({
            type: "order_by",
            byField: {
              type: theField.type,
              fieldIndex: byFieldIndex,
              name: this.nameOf(theField),
            },
            direction: order.dir,
            orderByIndex,
          });
        }
      }
    }
    return { items, orderByFields, inputSource: source };
  }

  fanToDef(fan: FilteredAliasedName, def: FieldTypeDef): FieldDef {
    const malloy: Fragment[] = [fan.name];
    if (fan.filterList && fan.filterList.length > 0) {
      malloy.push(" {", INDENT, "where:");
      malloy.push(...this.getFiltersString(fan.filterList || []));
      malloy.push(OUTDENT, "}");
    }
    const code = codeFromFragments(malloy);
    return {
      type: def.type,
      name: fan.as || fan.name,
      e: ["ignore"],
      aggregate: def.aggregate,
      code,
    };
  }
}

const INDENT = Symbol("indent");
const NEWLINE = Symbol("newline");
const OUTDENT = Symbol("outdent");

type Fragment = string | typeof INDENT | typeof OUTDENT | typeof NEWLINE;

const TAB_WIDTH = 2;

function codeFromFragments(fragments: Fragment[]) {
  let code = "";
  let indent = 0;
  let isStartOfLine = true;
  for (const fragment of fragments) {
    if (fragment === NEWLINE) {
      code += "\n";
      isStartOfLine = true;
    } else if (fragment === OUTDENT) {
      indent--;
    } else if (fragment === INDENT) {
      indent++;
    } else {
      if (isStartOfLine) {
        code += " ".repeat(indent * TAB_WIDTH);
        isStartOfLine = false;
      }
      code += fragment;
    }
  }
  return code;
}
