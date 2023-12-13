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
import {mergeFields, nameOf} from '../../field-utils';
import {FieldName, FieldSpace, QueryFieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {SpaceField} from '../types/space-field';

import {WildcardFieldReference} from '../query-items/field-references';
import {RefinedSpace} from './refined-space';
import {LookupResult} from '../types/lookup-result';
import {ColumnSpaceField} from './column-space-field';
import {StructSpaceField} from './static-space';
import {QueryInputSpace} from './query-input-space';

/**
 * The output space of a query operation, it is not named "QueryOutputSpace"
 * because this is the namespace of the Query. This is the one which is constructed
 * with the query. The QueryInputSpace is created and paired when a
 * QuerySpace is created.
 */
export abstract class QuerySpace
  extends RefinedSpace
  implements QueryFieldSpace
{
  private exprSpace: QueryInputSpace;
  abstract readonly segmentType: 'reduce' | 'project' | 'index';
  expandedWild: Record<string, string[]> = {};

  constructor(
    readonly queryInputSpace: FieldSpace,
    refineThis: model.PipeSegment | undefined,
    readonly nestParent: QuerySpace | undefined,
    readonly astEl: MalloyElement
  ) {
    super(queryInputSpace.emptyStructDef());
    this.exprSpace = new QueryInputSpace(queryInputSpace, this);
    if (refineThis) this.addRefineFromFields(refineThis);
  }

  private addRefineFromFields(refineThis: model.PipeSegment) {
    for (const field of refineThis.fields) {
      if (typeof field === 'string') {
        const ent = this.exprSpace.entry(field);
        if (ent) {
          this.setEntry(field, ent);
        }
      } else if (model.isFilteredAliasedName(field)) {
        const name = field.as ?? field.name;
        const ent = this.exprSpace.entry(name);
        if (ent) {
          this.setEntry(name, ent);
        }
      } else {
        // TODO can you reference fields in a turtle as fields in the output space,
        // e.g. order_by: my_turtle.foo, or lag(my_turtle.foo)
        if (field.type !== 'turtle') {
          this.setEntry(field.as ?? field.name, new ColumnSpaceField(field));
        }
      }
    }
  }

  log(s: string): void {
    if (this.astEl) {
      this.astEl.log(s);
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
            pathPart.log(
              `Field '${part}' does not contain rows and cannot be expanded with '*'`
            );
            return;
          }
        } else {
          pathPart.log(`No such field as '${part}'`);
          return;
        }
      }
    }
    const dialect = this.dialectObj();
    for (const [name, entry] of current.entries()) {
      if (wild.except.has(name)) {
        continue;
      }
      if (this.entry(name)) {
        const conflict = this.expandedWild[name]?.join('.');
        wild.log(
          `Cannot expand '${name}' in '${
            wild.refString
          }' because a field with that name already exists${
            conflict ? ` (conflicts with ${conflict})` : ''
          }`
        );
      } else {
        const eType = entry.typeDesc();
        if (
          model.isAtomicFieldType(eType.dataType) &&
          model.expressionIsScalar(eType.expressionType) &&
          (dialect === undefined || !dialect.ignoreInProject(name))
        ) {
          this.setEntry(name, entry);
          this.expandedWild[name] = joinPath.concat(name);
        }
      }
    }
  }

  canContain(_typeDesc: model.TypeDesc): boolean {
    return true;
  }

  protected queryFieldDefs(): model.QueryFieldDef[] {
    const fields: model.QueryFieldDef[] = [];
    for (const [name, field] of this.entries()) {
      if (field instanceof SpaceField) {
        const wildPath = this.expandedWild[name];
        if (wildPath) {
          fields.push(wildPath.join('.'));
          continue;
        }
        const fieldQueryDef = field.getQueryFieldDef(this.exprSpace);
        if (fieldQueryDef) {
          const typeDesc = field.typeDesc();
          // Filter out fields whose type is 'error', which means that a totally bad field
          // isn't sent to the compiler, where it will wig out.
          // TODO Figure out how to make errors generated by `canContain` go in the right place,
          // maybe by adding a logable element to SpaceFields.
          if (
            typeDesc.dataType !== 'error' &&
            this.canContain(typeDesc) &&
            !isEmptyNest(fieldQueryDef)
          ) {
            fields.push(fieldQueryDef);
          }
        }
        // TODO I removed the error here because during calculation of the refinement space,
        // (see creation of a QuerySpace) we add references to all the fields from
        // the refinement, but they don't have definitions. So in the case where we
        // don't have a field def, we "know" that that field is already in the query,
        // and we don't need to worry about actually adding it. Previously, this was also true for
        // project statements, where we added "*" as a field and also all the individual
        // fields, but the individual fields didn't have field defs.
      }
    }
    this.isComplete();
    return fields;
  }

  getQuerySegment(rf: model.QuerySegment | undefined): model.QuerySegment {
    const p = this.getPipeSegment(rf);
    if (model.isQuerySegment(p)) {
      return p;
    }
    throw new Error('TODO NOT POSSIBLE');
  }

  getPipeSegment(
    refineFrom: model.QuerySegment | undefined
  ): model.PipeSegment {
    if (this.segmentType === 'index') {
      // TODO ... should make this go away
      throw new Error('INDEX FIELD PIPE SEGMENT MIS HANDLED');
    }

    if (refineFrom?.extendSource) {
      for (const xField of refineFrom.extendSource) {
        this.exprSpace.addFieldDef(xField);
      }
    }

    const segment: model.QuerySegment = {
      type: this.segmentType,
      fields: this.queryFieldDefs(),
    };

    segment.fields = mergeFields(refineFrom?.fields, segment.fields);

    if (refineFrom?.extendSource) {
      segment.extendSource = refineFrom.extendSource;
    }
    if (this.exprSpace.extendList.length > 0) {
      const newExtends: model.FieldDef[] = [];
      const extendedStruct = this.exprSpace.structDef();

      for (const extendName of this.exprSpace.extendList) {
        const extendEnt = extendedStruct.fields.find(
          f => nameOf(f) === extendName
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
    this.isComplete();
    return segment;
  }

  lookup(path: FieldName[]): LookupResult {
    const result = super.lookup(path);
    if (result.found) {
      return {...result, isOutputField: true};
    }
    return this.exprSpace.lookup(path);
  }

  isQueryFieldSpace() {
    return true;
  }

  outputSpace() {
    return this;
  }

  inputSpace() {
    return this.exprSpace;
  }
}

export class ReduceFieldSpace extends QuerySpace {
  readonly segmentType = 'reduce';
}

function isEmptyNest(fd: model.QueryFieldDef) {
  return (
    typeof fd !== 'string' &&
    !model.isFilteredAliasedName(fd) &&
    fd.type === 'turtle' &&
    fd.pipeline.length === 0
  );
}
