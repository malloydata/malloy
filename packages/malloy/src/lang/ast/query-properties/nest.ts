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
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {QueryField} from '../field-space/query-space-field';
import {
  LegalRefinementStage,
  QueryClass,
  QueryPropertyInterface,
} from '../types/query-property-interface';
import {QueryBuilder} from '../types/query-builder';
import {MakeEntry} from '../types/space-entry';
import {DynamicSpace} from '../field-space/dynamic-space';
import {QuerySpace} from '../field-space/query-spaces';
import {
  expressionIsAggregate,
  expressionIsAnalytic,
  expressionIsScalar,
  TypeDesc,
} from '../../../model';
import {FieldReference} from '../query-items/field-references';
import {SpaceField} from '../types/space-field';
import {QueryFieldStruct} from '../field-space/query-field-struct';
import {ReferenceView, View} from '../query-elements/view';

export class ViewDefinition
  extends MalloyElement
  implements QueryPropertyInterface
{
  elementType = 'view-definition';
  queryRefinementStage = LegalRefinementStage.Single;
  forceQueryClass = QueryClass.Grouping;

  constructor(
    readonly name: string,
    readonly view: View
  ) {
    super({view});
  }

  queryExecute(executeFor: QueryBuilder) {
    executeFor.resultFS.pushFields(this);
  }

  makeEntry(fs: DynamicSpace) {
    const qf = new ViewField(fs, this, this.name);
    fs.newEntry(this.name, this, qf);
  }

  getFieldDef(fs: FieldSpace): model.TurtleDef {
    const pipeline = this.view.pipeline(fs);
    return {
      type: 'turtle',
      name: this.name,
      pipeline,
    };
  }
}

export class NestDefinition extends ViewDefinition {
  elementType = 'nest-definition';

  getFieldDef(fs: FieldSpace): model.TurtleDef {
    if (fs.isQueryFieldSpace()) {
      // TODO annotations
      return {
        type: 'turtle',
        name: this.name,
        pipeline: this.view.pipeline(fs, fs.outputSpace()),
      };
    }
    throw this.internalError('Unexpected namespace for nest');
  }
}

export function isNestedQuery(me: MalloyElement): me is NestedQuery {
  return me instanceof ReferenceView || me instanceof NestDefinition;
}

export class ViewField extends QueryField {
  renameAs?: string;
  constructor(
    fs: FieldSpace,
    readonly turtle: NestedQuery,
    protected name: string
  ) {
    super(fs);
  }

  getQueryFieldDef(fs: FieldSpace): model.QueryFieldDef {
    const def = this.turtle.getFieldDef(fs);
    if (this.renameAs) {
      def.as = this.renameAs;
    }
    return def;
  }

  fieldDef(): model.TurtleDef {
    const def = this.turtle.getFieldDef(this.inSpace);
    if (this.renameAs) {
      def.as = this.renameAs;
    }
    return def;
  }
}

export class NestReference
  extends FieldReference
  implements QueryPropertyInterface, MakeEntry
{
  elementType = 'nestReference';
  forceQueryClass = QueryClass.Grouping;
  queryRefinementStage = LegalRefinementStage.Single;

  constructor(readonly name: FieldReference) {
    super([...name.list]);
  }
  typecheck(type: TypeDesc) {
    if (type.dataType !== 'turtle') {
      let useInstead: string;
      let kind: string;
      if (expressionIsAnalytic(type.expressionType)) {
        useInstead = 'a calculate';
        kind = 'an analytic';
      } else {
        if (this.inExperiment('scalar_lenses', true)) {
          return;
        }
        if (expressionIsScalar(type.expressionType)) {
          useInstead = 'a group_by or select';
          kind = 'a scalar';
        } else if (expressionIsAggregate(type.expressionType)) {
          useInstead = 'an aggregate';
          kind = 'an aggregate';
        } else {
          throw new Error(
            `Unexpected expression type ${type} not handled here`
          );
        }
        this.log(
          `Cannot use ${kind} field in a nest operation, did you mean to use ${useInstead} operation instead?`
        );
      }
    }
  }

  // TODO refactor this
  makeEntry(fs: DynamicSpace): void {
    if (fs instanceof QuerySpace) {
      const lookup = this.name.getField(fs.inputSpace());
      if (lookup.found instanceof SpaceField) {
        const field = lookup.found.fieldDef();
        if (field && model.isAtomicField(field)) {
          const name = field.as ?? field.name;
          fs.newEntry(
            name,
            this,
            new QueryFieldStruct(fs, {
              type: 'turtle',
              name,
              pipeline: [
                {
                  type: 'reduce',
                  fields: [
                    {
                      type: field.type,
                      name,
                      expressionType: field.expressionType,
                      e: [{type: 'field', path: this.name.refString}],
                    },
                  ],
                },
              ],
            })
          );
          return;
        }
      }
      if (this.name.list.length > 1) {
        this.log('Cannot nest view from join');
        return;
      }
      return super.makeEntry(fs);
    }
    throw this.internalError('Unexpected namespace for nest');
  }

  queryExecute(executeFor: QueryBuilder) {
    executeFor.resultFS.pushFields(this);
  }
}

export type NestedQuery = ReferenceView | NestDefinition;
