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
import {FieldName, FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {Noteable, extendNoteMethod} from '../types/noteable';
import {QueryField} from '../field-space/query-space-field';
import {TurtleHeadedPipe} from '../elements/pipeline-desc';
import {QueryInputSpace} from '../field-space/query-input-space';
import {StaticSpace} from '../field-space/static-space';
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

function isTurtle(fd: model.QueryFieldDef | undefined): fd is model.TurtleDef {
  const ret =
    fd && typeof fd !== 'string' && (fd as model.TurtleDef).type === 'turtle';
  return !!ret;
}

abstract class TurtleDeclRoot
  extends TurtleHeadedPipe
  implements Noteable, MakeEntry
{
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: model.Annotation;
  constructor(readonly name: string) {
    super();
  }

  getPipeline(fs: FieldSpace): model.Pipeline {
    const modelPipe: model.Pipeline = {pipeline: []};
    if (this.turtleName) {
      const headEnt = this.turtleName.getField(fs);
      let reportWrongType = true;
      if (headEnt.error) {
        this.log(headEnt.error);
        reportWrongType = false;
      } else if (headEnt.found instanceof QueryField) {
        const headDef = headEnt.found.getQueryFieldDef(fs);
        if (isTurtle(headDef)) {
          const newPipe = this.refinePipeline(fs, headDef);
          modelPipe.pipeline = [...newPipe.pipeline];
          if (headDef.annotation) {
            this.extendNote({inherits: headDef.annotation});
          }
          reportWrongType = false;
        }
      }
      if (reportWrongType) {
        this.log(`Expected '${this.turtleName}' to be a query`);
      }
    } else if (this.withRefinement) {
      throw this.internalError(
        "Can't refine the head of a view  in its definition"
      );
    }

    let pipeOutFS = fs;
    if (modelPipe.pipeline.length > 0) {
      const lastOut = this.getFinalStruct(fs.structDef(), modelPipe.pipeline);
      pipeOutFS = new StaticSpace(lastOut);
    }
    const appended = this.appendOps(pipeOutFS, modelPipe.pipeline);
    modelPipe.pipeline = appended.opList;
    return modelPipe;
  }

  getFieldDef(
    fs: FieldSpace,
    nestParent: QueryInputSpace | undefined
  ): model.TurtleDef {
    if (nestParent) {
      this.nestedInQuerySpace = nestParent;
    }
    const pipe = this.getPipeline(fs);
    const turtle: model.TurtleDef = {
      type: 'turtle',
      name: this.name,
      ...pipe,
      location: this.location,
    };
    if (this.note) {
      turtle.annotation = this.note;
    }
    return turtle;
  }

  makeEntry(fs: DynamicSpace) {
    fs.newEntry(this.name, this, new QueryFieldAST(fs, this, this.name));
  }
}

export class TurtleDecl extends TurtleDeclRoot {
  elementType = 'turtleDecl';
}

export class NestRefinement
  extends TurtleDeclRoot
  implements QueryPropertyInterface
{
  elementType = 'nestRefinement';
  queryRefinementStage = LegalRefinementStage.Single;
  forceQueryClass = QueryClass.Grouping;

  constructor(turtleName: FieldName) {
    super(turtleName.refString);
    this.turtleName = turtleName;
  }

  queryExecute(executeFor: QueryBuilder) {
    executeFor.resultFS.pushFields(this);
  }

  makeEntry(fs: DynamicSpace) {
    if (fs instanceof QuerySpace) {
      const qf = new QueryFieldAST(fs, this, this.name);
      qf.nestParent = fs.inputSpace();
      fs.newEntry(this.name, this, qf);
      return;
    }
    throw this.internalError('Unexpected namespace for nest');
  }
}

export class NestDefinition
  extends TurtleDeclRoot
  implements QueryPropertyInterface
{
  elementType = 'nestDefinition';
  queryRefinementStage = LegalRefinementStage.Single;
  forceQueryClass = QueryClass.Grouping;

  constructor(name: string) {
    super(name);
  }

  queryExecute(executeFor: QueryBuilder) {
    executeFor.resultFS.pushFields(this);
  }

  makeEntry(fs: DynamicSpace) {
    if (fs instanceof QuerySpace) {
      const qf = new QueryFieldAST(fs, this, this.name);
      qf.nestParent = fs.inputSpace();
      fs.newEntry(this.name, this, qf);
      return;
    }
    throw this.internalError('Unexpected namespace for nest');
  }
}

export function isNestedQuery(me: MalloyElement): me is NestedQuery {
  return (
    me instanceof NestRefinement ||
    me instanceof NestReference ||
    me instanceof NestDefinition
  );
}

export class QueryFieldAST extends QueryField {
  renameAs?: string;
  nestParent?: QueryInputSpace;
  constructor(
    fs: FieldSpace,
    readonly turtle: TurtleDecl,
    protected name: string
  ) {
    super(fs);
  }

  getQueryFieldDef(fs: FieldSpace): model.QueryFieldDef {
    const def = this.turtle.getFieldDef(fs, this.nestParent);
    if (this.renameAs) {
      def.as = this.renameAs;
    }
    return def;
  }

  fieldDef(): model.TurtleDef {
    const def = this.turtle.getFieldDef(this.inSpace, this.nestParent);
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

  constructor(readonly name: FieldName) {
    super([name]);
  }
  typecheck(type: TypeDesc) {
    if (type.dataType !== 'turtle') {
      let useInstead: string;
      let kind: string;
      if (expressionIsAnalytic(type.expressionType)) {
        useInstead = 'a calculate';
        kind = 'an analytic';
      } else if (expressionIsScalar(type.expressionType)) {
        useInstead = 'a group_by or select';
        kind = 'a scalar';
      } else if (expressionIsAggregate(type.expressionType)) {
        useInstead = 'an aggregate';
        kind = 'an aggregate';
      } else {
        throw new Error(`Unexpected expression type ${type} not handled here`);
      }
      this.log(
        `Cannot use ${kind} field in a nest operation, did you mean to use ${useInstead} operation instead?`
      );
    }
  }

  queryExecute(executeFor: QueryBuilder) {
    executeFor.resultFS.pushFields(this);
  }
}

export type NestedQuery = NestReference | NestDefinition | NestRefinement;
