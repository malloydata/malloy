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
import {FieldDeclaration} from '../query-items/field-declaration';
import {FieldName, FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {Join} from '../query-properties/joins';
import {SpaceField} from '../types/space-field';
import {SourceSpec, SpaceSeed} from '../space-seed';

import {QueryFieldAST, isNestedQuery} from '../query-properties/nest';
import {NestReference} from '../query-properties/nest-reference';
import {
  FieldReference,
  WildcardFieldReference,
} from '../query-items/field-references';
import {FieldCollectionMember} from '../types/field-collection-member';
import {QueryItem} from '../types/query-item';
import {ReferenceField} from './reference-field';
import {WildSpaceField} from './wild-space-field';
import {RefinedSpace} from './refined-space';
import {LookupResult} from '../types/lookup-result';
import {SpaceEntry} from '../types/space-entry';
import { ColumnSpaceField } from './column-space-field';

/**
 * Unlike a source, which is a refinement of a namespace, a query
 * is creating a new unrelated namespace. The query starts with a
 * source, which it might modify. This set of fields used to resolve
 * expressions in the query is called the "input space". There is a
 * specialized QuerySpace for each type of query operation.
 */

export class QueryInputSpace extends RefinedSpace {
  nestParent?: QueryInputSpace;
  extendList: string[] = [];

  constructor(input: SourceSpec, readonly result: QuerySpace) {
    const inputSpace = new SpaceSeed(input);
    super(inputSpace.structDef);
  }

  extendSource(extendField: Join | FieldDeclaration): void {
    this.addField(extendField);
    if (extendField instanceof Join) {
      this.extendList.push(extendField.name.refString);
    } else {
      this.extendList.push(extendField.defineName);
    }
  }

  isQueryFieldSpace() {
    return true;
  }

  outputSpace() {
    return this.result;
  }
}

// TODO maybe rename QueryOutputSpace
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
        this.addField(member);
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
    this.setEntry(wild.refString, new WildSpaceField(wild.refString));
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
          parent.result.checkUngroup(fn, isExclude);
        });
      } else {
        const uName = isExclude ? 'exclude()' : 'all()';
        fn.log(`${uName} '${fn.refString}' is missing from query output`);
      }
    }
  }

  addQueryItems(...qiList: QueryItem[]): void {
    for (const qi of qiList) {
      if (qi instanceof FieldReference || qi instanceof NestReference) {
        this.addReference(qi);
      } else if (qi instanceof FieldDeclaration) {
        this.addField(qi);
      } else if (isNestedQuery(qi)) {
        const qf = new QueryFieldAST(this, qi, qi.name);
        qf.nestParent = this.exprSpace;
        this.setEntry(qi.name, qf);
      } else {
        // Compiler will error if we don't handle all cases
        const _itemNotHandled: never = qi;
      }
    }
  }

  canContain(_qd: model.QueryFieldDef): boolean {
    return true;
  }

  protected queryFieldDefs(): model.QueryFieldDef[] {
    const fields: model.QueryFieldDef[] = [];
    for (const [name, field] of this.entries()) {
      if (field instanceof SpaceField) {
        const fieldQueryDef = field.getQueryFieldDef(this.exprSpace);
        if (fieldQueryDef) {
          if (this.canContain(fieldQueryDef)) {
            fields.push(fieldQueryDef);
          } else {
            this.log(`'${name}' not legal in ${this.segmentType}`);
          }
        }
        // TODO
        // else {
        //   throw new Error(`'${name}' does not have a QueryFieldDef`);
        // }
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
