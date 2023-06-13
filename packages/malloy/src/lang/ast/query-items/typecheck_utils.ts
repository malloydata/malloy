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

import {
  expressionIsAggregate,
  expressionIsAnalytic,
  expressionIsScalar,
  TypeDesc,
} from '../../../model';
import {MalloyElement} from '../types/malloy-element';

export function typecheckProject(type: TypeDesc, logTo: MalloyElement) {
  if (type.dataType === 'turtle' || !expressionIsScalar(type.expressionType)) {
    let useInstead: string;
    let kind: string;
    if (type.dataType === 'turtle') {
      useInstead = 'a nest';
      kind = 'a query';
    } else if (expressionIsAnalytic(type.expressionType)) {
      useInstead = 'a calculate';
      kind = 'an analytic';
    } else if (expressionIsAggregate(type.expressionType)) {
      useInstead = 'an aggregate';
      kind = 'an aggregate';
    } else {
      throw new Error(
        `Unexpected expression type ${type.expressionType} not handled here`
      );
    }
    logTo.log(
      `Cannot use ${kind} field in a project operation, did you mean to use ${useInstead} operation instead?`
    );
  }
}

export function typecheckIndex(type: TypeDesc, logTo: MalloyElement) {
  if (type.dataType === 'turtle' || !expressionIsScalar(type.expressionType)) {
    let kind: string;
    if (type.dataType === 'turtle') {
      kind = 'a query';
    } else if (expressionIsAnalytic(type.expressionType)) {
      kind = 'an analytic';
    } else if (expressionIsAggregate(type.expressionType)) {
      kind = 'an aggregate';
    } else {
      throw new Error(
        `Unexpected expression type ${type.expressionType} not handled here`
      );
    }
    logTo.log(`Cannot use ${kind} field in an index operation`);
  }
}

export function typecheckDimension(type: TypeDesc, logTo: MalloyElement) {
  if (!expressionIsScalar(type.expressionType)) {
    if (expressionIsAggregate(type.expressionType)) {
      logTo.log(
        'Cannot use an aggregate field in a dimension declaration, did you mean to use a measure declaration instead?'
      );
    } else if (expressionIsAnalytic(type.expressionType)) {
      logTo.log('Cannot use an analytic field in a dimension declaration');
    } else {
      throw new Error(
        `Unexpected expression type ${type.expressionType} not handled here`
      );
    }
  }
}

export function typecheckMeasure(type: TypeDesc, logTo: MalloyElement) {
  if (!expressionIsAggregate(type.expressionType)) {
    if (expressionIsScalar(type.expressionType)) {
      logTo.log(
        'Cannot use a scalar field in a measure declaration, did you mean to use a dimension declaration instead?'
      );
    } else if (expressionIsAnalytic(type.expressionType)) {
      logTo.log('Cannot use an analytic field in a measure declaration');
    } else {
      throw new Error(
        `Unexpected expression type ${type.expressionType} not handled here`
      );
    }
  }
}

export function typecheckDeclare(type: TypeDesc, logTo: MalloyElement) {
  if (type.dataType === 'turtle') {
    logTo.log('Query fields cannot be used in a declare block');
  } else if (expressionIsAnalytic(type.expressionType)) {
    logTo.log('Analytic expressions can not be used in a declare block');
  }
}

export function typecheckCalculate(type: TypeDesc, logTo: MalloyElement) {
  if (
    type.dataType === 'turtle' ||
    !expressionIsAnalytic(type.expressionType)
  ) {
    let useInstead: string;
    let kind: string;
    if (type.dataType === 'turtle') {
      useInstead = 'a nest';
      kind = 'a query';
    } else if (expressionIsAggregate(type.expressionType)) {
      useInstead = 'an aggregate';
      kind = 'an aggregate';
    } else if (expressionIsScalar(type.expressionType)) {
      useInstead = 'a group_by or project';
      kind = 'a scalar';
    } else {
      throw new Error(
        `Unexpected expression type ${type.expressionType} not handled here`
      );
    }
    logTo.log(
      `Cannot use ${kind} field in a calculate operation, did you mean to use ${useInstead} operation instead?`
    );
  }
}

export function typecheckAggregate(type: TypeDesc, logTo: MalloyElement) {
  if (
    type.dataType === 'turtle' ||
    !expressionIsAggregate(type.expressionType)
  ) {
    let useInstead: string;
    let kind: string;
    if (type.dataType === 'turtle') {
      useInstead = 'a nest';
      kind = 'a query';
    } else if (expressionIsAnalytic(type.expressionType)) {
      useInstead = 'a calculate';
      kind = 'an analytic';
    } else if (expressionIsScalar(type.expressionType)) {
      useInstead = 'a group_by or project';
      kind = 'a scalar';
    } else {
      throw new Error(`Unexpected expression type ${type} not handled here`);
    }
    logTo.log(
      `Cannot use ${kind} field in an aggregate operation, did you mean to use ${useInstead} operation instead?`
    );
  }
}

export function typecheckGroupBy(type: TypeDesc, logTo: MalloyElement) {
  if (type.dataType === 'turtle' || !expressionIsScalar(type.expressionType)) {
    let useInstead: string;
    let kind: string;
    if (type.dataType === 'turtle') {
      useInstead = 'a nest';
      kind = 'a query';
    } else if (expressionIsAnalytic(type.expressionType)) {
      useInstead = 'a calculate';
      kind = 'an analytic';
    } else if (expressionIsAggregate(type.expressionType)) {
      useInstead = 'an aggregate';
      kind = 'an aggregate';
    } else {
      throw new Error(
        `Unexpected expression type ${type.expressionType} not handled here`
      );
    }
    logTo.log(
      `Cannot use ${kind} field in a group_by operation, did you mean to use ${useInstead} operation instead?`
    );
  }
}
