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

import {NestedQuery} from '../types/nested-query';
import {FieldName, FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {NestReference} from './nest-reference';
import {QueryField} from '../field-space/query-space-field';
import {opOutputStruct} from '../struct-utils';
import {TurtleHeadedPipe} from '../types/turtle-headed-pipe';
import {QueryInputSpace} from '../field-space/query-spaces';
import {StaticSpace} from '../field-space/static-space';
import {Noteable} from '../elements/doc-annotation';

function isTurtle(fd: model.QueryFieldDef | undefined): fd is model.TurtleDef {
  const ret =
    fd && typeof fd !== 'string' && (fd as model.TurtleDef).type === 'turtle';
  return !!ret;
}

export class TurtleDecl extends TurtleHeadedPipe implements Noteable {
  readonly isNoteable = true;
  annotation?: model.Annotation;
  constructor(readonly name: string) {
    super();
  }

  setAnnotation(note: model.Annotation): void {
    this.annotation = note;
  }

  getAnnotation(): model.Annotation | undefined {
    return this.annotation;
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
          reportWrongType = false;
        }
      }
      if (reportWrongType) {
        this.log(`Expected '${this.turtleName}' to be a query`);
      }
    } else if (this.headRefinement) {
      throw this.internalError(
        "Can't refine the head of a turtle in its definition"
      );
    }

    let appendInput = fs;
    if (modelPipe.pipeline.length > 0) {
      let endStruct = appendInput.structDef();
      for (const existingSeg of modelPipe.pipeline) {
        endStruct = opOutputStruct(this, endStruct, existingSeg);
      }
      appendInput = new StaticSpace(endStruct);
    }
    const appended = this.appendOps(modelPipe.pipeline, appendInput);
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
    if (this.annotation) {
      turtle.annotation = this.annotation;
    }
    return turtle;
  }
}

export class NestRefinement extends TurtleDecl {
  elementType = 'nestRefinement';
  constructor(turtleName: FieldName) {
    super(turtleName.refString);
    this.turtleName = turtleName;
  }
}

export class NestDefinition extends TurtleDecl {
  elementType = 'nestDefinition';
  constructor(name: string) {
    super(name);
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
