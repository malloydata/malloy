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
import {FieldName, FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {SpaceField} from '../types/space-field';

import {
  FieldReference,
  WildcardFieldReference,
} from '../query-items/field-references';
import {FieldCollectionMember} from '../types/field-collection-member';
import {ReferenceField} from './reference-field';
import {WildSpaceField} from './wild-space-field';
import {RefinedSpace} from './refined-space';
import {LookupResult} from '../types/lookup-result';
import {SpaceEntry} from '../types/space-entry';
import {ColumnSpaceField} from './column-space-field';
import {StructSpaceField} from './static-space';
import {QueryInputSpace} from './query-input-space';

/**
 * The output space of a query operation, it is not named "QueryOutputSpace"
 * because this is the namespace of the Query. This is the one which is constructed
 * with the query. The QueryInputSpace is created and paired when a
 * QuerySpace is created.
 */
export abstract class QuerySpace extends RefinedSpace {
  readonly exprSpace: QueryInputSpace;
  astEl?: MalloyElement | undefined;
  abstract readonly segmentType: 'reduce' | 'project' | 'index';
  constructor(
    readonly queryInputSpace: FieldSpace,
    refineThis: model.PipeSegment | undefined
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

  addMembers(members: FieldCollectionMember[]): void {
    for (const member of members) {
      if (member instanceof FieldReference) {
        this.addReference(member);
      } else if (member instanceof WildcardFieldReference) {
        this.addWild(member);
      } else {
        this.pushFields(member);
      }
    }
  }

  addReference(ref: FieldReference): void {
    const refName = ref.outputName;
    if (this.entry(refName)) {
      ref.log(`Output already has a field named '${refName}'`);
    } else {
      this.setEntry(refName, new ReferenceField(ref));
    }
  }

  addWild(wild: WildcardFieldReference): void {
    let success = true;
    let current = this.exprSpace as FieldSpace;
    const parts = wild.refString.split('.');
    const conflictMap = {};
    function logConflict(name: string, parentRef: string | undefined) {
      const conflict = conflictMap[name];
      wild.log(
        `Cannot expand '${name}'${
          parentRef ? ` in ${parentRef}` : ''
        } because a field with that name already exists${
          conflict ? ` (conflicts with ${conflict})` : ''
        }`
      );
      success = false;
    }
    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi];
      const prevParts = parts.slice(0, pi);
      const parentRef = pi > 0 ? prevParts.join('.') : undefined;
      const fullName = [...prevParts.join('.'), part].join('.');
      if (part === '*') {
        for (const [name, entry] of current.entries()) {
          if (this.entry(name)) {
            logConflict(name, parentRef);
            success = false;
          }
          if (model.expressionIsScalar(entry.typeDesc().expressionType)) {
            this.setEntry(name, entry);
            conflictMap[name] = fullName;
          }
        }
      } else if (part === '**') {
        // TODO actually handle **
        wild.log('** is currently broken');
        success = false;
        // const spaces: {space: FieldSpace; ref: string | undefined}[] = [
        //   {space: current, ref: undefined},
        // ];
        // let toExpand: {space: FieldSpace; ref: string | undefined} | undefined;
        // while ((toExpand = spaces.pop())) {
        //   for (const [name, entry] of toExpand.space.entries()) {
        //     if (this.entry(name)) {
        //       logConflict(name, toExpand.ref);
        //       success = false;
        //     }
        //     if (model.expressionIsScalar(entry.typeDesc().expressionType)) {
        //       this.setEntry(name, entry);
        //       conflictMap[name] = toExpand.ref
        //         ? `${toExpand.ref}.${name}`
        //         : name;
        //     }
        //     if (entry instanceof StructSpaceField) {
        //       spaces.push({
        //         space: entry.fieldSpace,
        //         ref: [
        //           ...(parentRef ? [parentRef] : []),
        //           ...(toExpand.ref ? [toExpand.ref] : []),
        //           name,
        //         ].join('.'),
        //       });
        //     }
        //   }
        // }
      } else {
        const ent = current.entry(part);
        if (ent) {
          if (ent instanceof StructSpaceField) {
            current = ent.fieldSpace;
          } else {
            wild.log(
              `Field '${part}'${
                parentRef ? ` in ${parentRef}` : ''
              } is not a struct`
            );
            success = false;
          }
        } else {
          wild.log(
            `No such field '${part}'${parentRef ? ` in ${parentRef}` : ''}`
          );
          success = false;
        }
      }
    }
    if (success) {
      // TODO perform the entire replacement of * and ** here in the parser.
      // Today, we add all the fields to the output space, and then still add * to
      // the query. The compiler then does a second * expansion. Instead, we should
      // just add all the fields to the query here and then remove the code in the compiler
      // for expanding the *.
      this.setEntry(wild.refString, new WildSpaceField(wild.refString));
    }
  }

  /**
   * Check for the definition of an ungrouping reference in the result space,
   * or in the case of an exclude reference, if this query is nested
   * in another query, in the result space of a query that this query
   * is nested inside of.
   */
  checkUngroup(fn: FieldName, isExclude: boolean): void {
    if (!this.entry(fn.refString)) {
      if (isExclude && this.exprSpace.nestParent) {
        const parent = this.exprSpace.nestParent;
        parent.whenComplete(() => {
          const pOut = parent.outputSpace();
          // a little ugly, but it breaks a circularity problem
          if (pOut instanceof QuerySpace) {
            pOut.checkUngroup(fn, isExclude);
          }
        });
      } else {
        const uName = isExclude ? 'exclude()' : 'all()';
        fn.log(`${uName} '${fn.refString}' is missing from query output`);
      }
    }
  }

  canContain(_typeDesc: model.TypeDesc): boolean {
    return true;
  }

  protected queryFieldDefs(): model.QueryFieldDef[] {
    const fields: model.QueryFieldDef[] = [];
    for (const [, field] of this.entries()) {
      if (field instanceof SpaceField) {
        const fieldQueryDef = field.getQueryFieldDef(this.exprSpace);
        if (fieldQueryDef) {
          if (field instanceof WildSpaceField) {
            fields.push(fieldQueryDef);
          } else {
            const typeDesc = field.typeDesc();
            // Filter out fields whose type is 'error', which means that a totally bad field
            // isn't sent to the compiler, where it will wig out.
            // TODO Figure out how to make errors generated by `canContain` go in the right place,
            // maybe by adding a logable element to SpaceFields.
            if (typeDesc.dataType !== 'error' && this.canContain(typeDesc)) {
              fields.push(fieldQueryDef);
            }
          }
        }
        // TODO I removed the error here because during calculation of the refinement space,
        // (see creation of a QuerySpace) we add references to all the fields from
        // the refinement, but they don't have definitions. So in the case where we
        // don't have a field def, we "know" that that field is already in the query,
        // and we don't need to worry about actually adding it. This is also true for
        // project statements, where we add "*" as a field and also all the individuala
        // fields, but the individual fields don't have field defs.
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
      return {
        error: undefined,
        found: new OutputSpaceEntry(result.found),
      };
    }
    return this.exprSpace.lookup(path);
  }

  isQueryFieldSpace() {
    return true;
  }

  outputSpace() {
    return this;
  }
}

export class ReduceFieldSpace extends QuerySpace {
  readonly segmentType = 'reduce';
}

export class OutputSpaceEntry extends SpaceEntry {
  refType: 'field' | 'parameter';
  constructor(readonly inputSpaceEntry: SpaceEntry) {
    super();
    this.refType = inputSpaceEntry.refType;
  }

  typeDesc(): model.TypeDesc {
    const type = this.inputSpaceEntry.typeDesc();
    return {
      ...type,
      evalSpace: type.evalSpace === 'constant' ? 'constant' : 'output',
    };
  }
}
