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

import * as model from '../../../model/malloy_types';
import {mergeFields, nameFromDef} from '../../field-utils';
import type {
  FieldSpace,
  QueryFieldSpace,
  SourceFieldSpace,
} from '../types/field-space';
import {FieldName} from '../types/field-space';
import type {MalloyElement} from '../types/malloy-element';
import {SpaceField} from '../types/space-field';

import {
  RefineFromFieldReference,
  WildcardFieldReference,
} from '../query-items/field-references';
import {RefinedSpace} from './refined-space';
import type {LookupResult} from '../types/lookup-result';
import {StructSpaceField} from './static-space';
import {QueryInputSpace} from './query-input-space';
import type {SpaceEntry} from '../types/space-entry';
import type {
  LogMessageOptions,
  MessageCode,
  MessageParameterType,
} from '../../parse-log';
import {emptyFieldUsage, mergeFieldUsage} from '../../composite-source-utils';
import {ErrorFactory} from '../error-factory';
import {ReferenceField} from './reference-field';
import {RefineFromSpaceField} from './refine-from-space-field';

type TranslatedQueryField = {
  queryFieldDef: model.QueryFieldDef;
  typeDesc: model.TypeDesc;
};

/**
 * The output space of a query operation. It is not named "QueryOutputSpace"
 * because this is the namespace of the Query which is a layer of an output and
 * an input space. It constructed with the query operation. A QueryInputSpace is
 * created and paired when a QueryOperationSpace is created.
 */
export abstract class QueryOperationSpace
  extends RefinedSpace
  implements QueryFieldSpace
{
  protected exprSpace: QueryInputSpace;
  abstract readonly segmentType: 'reduce' | 'project' | 'index';
  expandedWild: Record<
    string,
    {path: string[]; entry: SpaceEntry; at: model.DocumentLocation}
  > = Object.create(null) as Record<
    string,
    {path: string[]; entry: SpaceEntry; at: model.DocumentLocation}
  >;
  drillDimensions: {
    nestPath: string[];
    firstDrill: MalloyElement;
    dimensionPath: string[];
    satisfied: boolean;
  }[] = [];
  compositeFieldUsers: (
    | {type: 'filter'; filter: model.FilterCondition}
    | {
        type: 'field';
        name: string;
        field: SpaceField;
      }
  )[] = [];

  // Composite field usage is not computed until `queryFieldDefs` is called
  // (or `getPipeSegment` for index segments); if anyone
  // tries to access it before that, they'll get an error
  _fieldUsage: model.FieldUsage[] | undefined = undefined;
  get fieldUsage(): model.FieldUsage[] {
    if (this._fieldUsage === undefined) {
      throw new Error('Field usage accessed before computed');
    }
    return this._fieldUsage;
  }

  constructor(
    queryInputSpace: SourceFieldSpace,
    refineThis: model.PipeSegment | undefined,
    readonly nestParent: QueryOperationSpace | undefined,
    readonly astEl: MalloyElement
  ) {
    super(queryInputSpace.emptyStructDef());

    this.exprSpace = new QueryInputSpace(
      queryInputSpace.structDef(),
      this,
      queryInputSpace.accessProtectionLevel()
    );
    if (refineThis) this.addRefineFromFields(refineThis);
  }

  abstract addRefineFromFields(refineThis: model.PipeSegment): void;

  logError<T extends MessageCode>(
    code: T,
    parameters: MessageParameterType<T>,
    options?: Omit<LogMessageOptions, 'severity'>
  ): T {
    if (this.astEl) {
      this.astEl.logError(code, parameters, options);
    }
    return code;
  }

  accessProtectionLevel(): model.AccessModifierLabel {
    return 'public';
  }

  inputSpace(): QueryInputSpace {
    return this.exprSpace;
  }

  outputSpace(): QueryOperationSpace {
    return this;
  }

  isQueryOutputSpace() {
    return true;
  }

  protected addWild(wild: WildcardFieldReference): void {
    let current: FieldSpace = this.exprSpace;
    const joinPath: string[] = [];
    if (wild.joinPath) {
      // walk path to determine namespace for *
      for (const pathPart of wild.joinPath.list) {
        const part = pathPart.refString;
        joinPath.push(part);

        const ent = current.entry(part);
        if (ent) {
          if (ent instanceof StructSpaceField) {
            current = ent.fieldSpace;
          } else {
            pathPart.logError(
              'invalid-wildcard-source',
              `Field '${part}' does not contain rows and cannot be expanded with '*'`
            );
            return;
          }
        } else {
          pathPart.logError(
            'wildcard-source-not-defined',
            `No such field as '${part}'`
          );
          return;
        }
      }
    }
    const dialect = this.dialectObj();
    const expandEntries: {name: string; entry: SpaceEntry}[] = [];
    for (const [name, entry] of current.entries()) {
      if (wild.except.has(name)) {
        continue;
      }
      if (entry.refType === 'parameter') {
        continue;
      }
      if (this.entry(name)) {
        const conflict = this.expandedWild[name]?.path.join('.');
        wild.logError(
          'name-conflict-in-wildcard-expansion',
          `Cannot expand '${name}' in '${
            wild.refString
          }' because a field with that name already exists${
            conflict ? ` (conflicts with ${conflict})` : ''
          }`
        );
      } else {
        const eType = entry.typeDesc();
        if (
          model.TD.isAtomic(eType) &&
          model.expressionIsScalar(eType.expressionType) &&
          (dialect === undefined || !dialect.ignoreInProject(name))
        ) {
          expandEntries.push({name, entry});
          this.expandedWild[name] = {
            path: joinPath.concat(name),
            entry,
            at: wild.location,
          };
        }
      }
    }
    // There were tests which expected these to be sorted, and that seems reasonable
    for (const x of expandEntries.sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      this.newEntry(x.name, wild, x.entry);
    }
  }

  protected addValidatedCompositeFieldUserFromEntry(
    name: string,
    entry: SpaceEntry
  ) {
    if (entry instanceof SpaceField) {
      this.compositeFieldUsers.push({
        type: 'field',
        name,
        field: entry,
      });
    }
  }

  public addFieldUserFromFilter(filter: model.FilterCondition) {
    if (filter.fieldUsage !== undefined) {
      this.compositeFieldUsers.push({type: 'filter', filter});
    }
  }

  newEntry(name: string, logTo: MalloyElement, entry: SpaceEntry): void {
    if (entry instanceof SpaceField) {
      this.compositeFieldUsers.push({type: 'field', name, field: entry});
    }
    super.newEntry(name, logTo, entry);
  }

  isQueryFieldSpace(): this is QueryFieldSpace {
    return true;
  }
}

// Project and Reduce or "QuerySegments" are built from a QuerySpace
export abstract class QuerySpace extends QueryOperationSpace {
  addRefineFromFields(refineThis: model.PipeSegment) {
    if (!model.isQuerySegment(refineThis)) {
      // TODO mtoy raw,partial,index
      return;
    }
    if (refineThis?.extendSource) {
      for (const xField of refineThis.extendSource) {
        this.exprSpace.addFieldDef(xField);
      }
    }
    for (const field of refineThis.queryFields) {
      if (field.type === 'fieldref') {
        const fieldReference = new RefineFromFieldReference(
          field.path.map(f => new FieldName(f))
        );
        this.astEl.has({fieldReference});
        const referenceField = new ReferenceField(
          fieldReference,
          this.exprSpace
        );
        const name = field.path[field.path.length - 1];
        this.setEntry(name, referenceField);
        this.addValidatedCompositeFieldUserFromEntry(name, referenceField);
      } else {
        const entry = new RefineFromSpaceField(field);
        const name = field.as ?? field.name;
        this.setEntry(name, entry);
        this.addValidatedCompositeFieldUserFromEntry(name, entry);
      }
    }
  }

  pushFields(...defs: MalloyElement[]): void {
    for (const f of defs) {
      if (f instanceof WildcardFieldReference) {
        this.addWild(f);
      } else {
        super.pushFields(f);
      }
    }
  }

  canContain(_typeDescResult: model.TypeDesc | undefined) {
    return true;
  }

  protected queryFieldDefs(): model.QueryFieldDef[] {
    const fields = this.translateQueryFields();
    return fields.map(f => f.queryFieldDef);
  }

  protected getOutputFieldDef(
    queryFieldDef: model.QueryFieldDef,
    typeDesc: model.TypeDesc
  ): model.FieldDef {
    let location: model.DocumentLocation | undefined = undefined;
    let name: string;

    if (queryFieldDef.type === 'fieldref') {
      name = queryFieldDef.path[queryFieldDef.path.length - 1];
      location = queryFieldDef.at;
    } else {
      name = queryFieldDef.as ?? queryFieldDef.name;
      location = queryFieldDef.location;
    }
    let ret: model.FieldDef;
    if (typeDesc.type === 'turtle') {
      const pipeline = typeDesc.pipeline;
      const lastSegment = pipeline[pipeline.length - 1];
      const outputStruct =
        lastSegment?.outputStruct ?? this.exprSpace.emptyStructDef();
      const isRepeated = lastSegment
        ? model.isQuerySegment(lastSegment)
          ? lastSegment.isRepeated
          : true
        : true;
      if (isRepeated) {
        ret = {
          ...outputStruct,
          elementTypeDef: {type: 'record_element'},
          name: name,
          type: 'array',
          join: 'many',
          as: undefined,
        };
      } else {
        ret = {
          ...outputStruct,
          name: name,
          type: 'record',
          join: 'one',
          as: undefined,
        };
      }
    } else if (model.TD.isAtomic(typeDesc)) {
      ret = {
        ...model.mkFieldDef(typeDesc, name),
        expressionType: 'scalar',
        location,
      };
    } else {
      throw new Error('Invalid type for fieldref');
    }
    ret.location = ret.location ?? this.astEl.location;
    if (queryFieldDef.annotation) {
      ret.annotation = queryFieldDef.annotation;
    }
    return ret;
  }

  // Gets the primary key field for the output struct of this query;
  // If there is exactly one scalar field, that is the primary key
  protected getPrimaryKey(fields: TranslatedQueryField[]) {
    const dimensions = fields.filter(
      f =>
        model.TD.isAtomic(f.typeDesc) &&
        model.expressionIsScalar(f.typeDesc.expressionType)
    );
    if (dimensions.length !== 1) return undefined;
    const primaryKeyField = dimensions[0].queryFieldDef;
    if (primaryKeyField.type === 'fieldref') {
      return primaryKeyField.path[primaryKeyField.path.length - 1];
    } else {
      return primaryKeyField.as ?? primaryKeyField.name;
    }
  }

  // This returns the OUTPUT struct of this query space
  structDef(): model.SourceDef {
    const fields = this.translateQueryFields();
    const sourceDef: model.SourceDef = {
      type: 'query_result',
      // TODO to match the compiler, does this need to be the name of the query?
      name: 'query_result',
      dialect: this.dialectName(),
      // TODO need to get this in a less expensive way?
      connection: this.inputSpace().connectionName(),
      fields: fields.map(f =>
        this.getOutputFieldDef(f.queryFieldDef, f.typeDesc)
      ),
      primaryKey: this.getPrimaryKey(fields),
    };
    return sourceDef;
  }

  translatedQueryFields: TranslatedQueryField[] | undefined;
  protected translateQueryFields(): TranslatedQueryField[] {
    if (this.translatedQueryFields) {
      return this.translatedQueryFields;
    }
    const fields: TranslatedQueryField[] = [];
    let fieldUsage = emptyFieldUsage();
    for (const user of this.compositeFieldUsers) {
      let nextFieldUsage: model.FieldUsage[] | undefined = undefined;
      if (user.type === 'filter') {
        if (user.filter.fieldUsage) {
          nextFieldUsage = user.filter.fieldUsage;
        }
      } else {
        const {name, field} = user;
        const wildPath = this.expandedWild[name];
        if (wildPath) {
          const typeDesc = wildPath.entry.typeDesc();
          fields.push({
            queryFieldDef: {
              type: 'fieldref',
              path: wildPath.path,
              at: wildPath.at,
            },
            typeDesc,
          });
          nextFieldUsage = typeDesc.fieldUsage;
        } else {
          const queryFieldDef = field.getQueryFieldDef(this.exprSpace);
          if (queryFieldDef) {
            const typeDesc = field.typeDesc();
            nextFieldUsage = typeDesc.fieldUsage;
            // Filter out fields whose type is 'error', which means that a totally bad field
            // isn't sent to the compiler, where it will wig out.
            // TODO Figure out how to make errors generated by `canContain` go in the right place,
            // maybe by adding a logable element to SpaceFields.
            if (
              typeDesc &&
              typeDesc.type !== 'error' &&
              this.canContain(typeDesc) &&
              !isEmptyNest(queryFieldDef)
            ) {
              fields.push({queryFieldDef, typeDesc});
            }
          } else {
            throw new Error('Expected query field to have a definition');
          }
        }
      }
      fieldUsage = mergeFieldUsage(fieldUsage, nextFieldUsage) ?? [];
    }
    this._fieldUsage = fieldUsage;

    for (const drillDimension of this.drillDimensions) {
      if (!drillDimension.satisfied) {
        drillDimension.firstDrill.logError(
          'illegal-drill',
          `Must provide a value for all dimensions in a view when drilling: missing \`${drillDimension.dimensionPath.join(
            '.'
          )}\``
        );
      }
    }

    this.translatedQueryFields = fields;
    return fields;
  }

  getQuerySegment(rf: model.QuerySegment | undefined): model.QuerySegment {
    const p = this.getPipeSegment(rf);
    if (model.isQuerySegment(p)) {
      return p;
    }
    throw new Error('TODO NOT POSSIBLE');
  }

  protected isRepeated(): boolean {
    const fields = this.translateQueryFields();
    const dimensions = fields.filter(
      f =>
        model.TD.isAtomic(f.typeDesc) &&
        model.expressionIsScalar(f.typeDesc.expressionType)
    );
    return dimensions.length > 0;
  }

  getPipeSegment(
    refineFrom: model.QuerySegment | undefined
  ): model.PipeSegment {
    if (this.segmentType === 'index') {
      // come coding error made this "impossible" thing happen
      this.logError(
        'unexpected-index-segment',
        'internal error generating index segment from non index query'
      );
      return ErrorFactory.reduceSegment;
    }

    const segment: model.QuerySegment = {
      type: this.segmentType,
      queryFields: this.queryFieldDefs(),
      outputStruct: this.structDef(),
      isRepeated: this.isRepeated(),
    };

    if (refineFrom?.extendSource) {
      segment.extendSource = refineFrom.extendSource;
    }
    if (this.exprSpace.extendList.length > 0) {
      const newExtends: model.FieldDef[] = [];
      const extendedStruct = this.exprSpace.structDef();

      for (const extendName of this.exprSpace.extendList) {
        const extendEnt = extendedStruct.fields.find(
          f => nameFromDef(f) === extendName
        );
        if (extendEnt) {
          newExtends.push(extendEnt);
        }
      }
      segment.extendSource = mergeFields(segment.extendSource, newExtends);
    }
    if (this.newTimezone) {
      segment.queryTimezone = this.newTimezone;
    }
    return segment;
  }

  lookup(path: FieldName[]): LookupResult {
    const result = super.lookup(path);
    if (result.found) {
      return {...result, isOutputField: true};
    }
    return this.exprSpace.lookup(path);
  }
}

export class ReduceFieldSpace extends QuerySpace {
  readonly segmentType = 'reduce';
}

function isEmptyNest(fd: model.QueryFieldDef) {
  return (
    typeof fd !== 'string' && fd.type === 'turtle' && fd.pipeline.length === 0
  );
}
