/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TypeDesc} from '../../../model';
import {
  expressionIsAggregate,
  expressionIsAnalytic,
  expressionIsScalar,
} from '../../../model';
import type {MessageCode} from '../../parse-log';
import type {MalloyElement} from '../types/malloy-element';

export function typecheckProject(type: TypeDesc, logTo: MalloyElement) {
  if (type.type === 'turtle' || !expressionIsScalar(type.expressionType)) {
    let useInstead: string;
    let kind: string;
    let code: MessageCode;
    if (type.type === 'turtle') {
      useInstead = 'a nest';
      kind = 'a view';
      code = 'select-of-view';
    } else if (expressionIsAnalytic(type.expressionType)) {
      useInstead = 'a calculate';
      kind = 'an analytic';
      code = 'select-of-analytic';
    } else if (expressionIsAggregate(type.expressionType)) {
      useInstead = 'an aggregate';
      kind = 'an aggregate';
      code = 'select-of-aggregate';
    } else {
      throw new Error(
        `Unexpected expression type ${type.expressionType} not handled here`
      );
    }
    logTo.logError(
      code,
      `Cannot use ${kind} field in a select operation, did you mean to use ${useInstead} operation instead?`
    );
  }
}

export function typecheckIndex(type: TypeDesc, logTo: MalloyElement) {
  if (type.type === 'turtle' || !expressionIsScalar(type.expressionType)) {
    let kind: string;
    let code: MessageCode;
    if (type.type === 'turtle') {
      kind = 'a view';
      code = 'index-of-view';
    } else if (expressionIsAnalytic(type.expressionType)) {
      kind = 'an analytic';
      code = 'index-of-analytic';
    } else if (expressionIsAggregate(type.expressionType)) {
      kind = 'an aggregate';
      code = 'index-of-aggregate';
    } else {
      throw new Error(
        `Unexpected expression type ${type.expressionType} not handled here`
      );
    }
    logTo.logError(code, `Cannot use ${kind} field in an index operation`);
  }
}

export function typecheckDimension(type: TypeDesc, logTo: MalloyElement) {
  if (!expressionIsScalar(type.expressionType)) {
    if (expressionIsAggregate(type.expressionType)) {
      logTo.logError(
        'aggregate-in-dimension',
        'Cannot use an aggregate field in a dimension declaration, did you mean to use a measure declaration instead?'
      );
    } else if (expressionIsAnalytic(type.expressionType)) {
      logTo.logError(
        'analytic-in-dimension',
        'Cannot use an analytic field in a dimension declaration'
      );
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
      logTo.logError(
        'scalar-in-measure',
        'Cannot use a scalar field in a measure declaration, did you mean to use a dimension declaration instead?'
      );
    } else if (expressionIsAnalytic(type.expressionType)) {
      logTo.logError(
        'analytic-in-measure',
        'Cannot use an analytic field in a measure declaration'
      );
    } else {
      throw new Error(
        `Unexpected expression type ${type.expressionType} not handled here`
      );
    }
  }
}

export function typecheckDeclare(type: TypeDesc, logTo: MalloyElement) {
  if (type.type === 'turtle') {
    logTo.logError(
      'view-in-declare',
      'Views cannot be used in a declare block'
    );
  } else if (expressionIsAnalytic(type.expressionType)) {
    logTo.logError(
      'analytic-in-declare',
      'Analytic expressions can not be used in a declare block'
    );
  }
}

export function typecheckCalculate(type: TypeDesc, logTo: MalloyElement) {
  if (type.type === 'turtle' || !expressionIsAnalytic(type.expressionType)) {
    let useInstead: string;
    let kind: string;
    let code: MessageCode;
    if (type.type === 'turtle') {
      useInstead = 'a nest';
      kind = 'a view';
      code = 'calculate-of-view';
    } else if (expressionIsAggregate(type.expressionType)) {
      useInstead = 'an aggregate';
      kind = 'an aggregate';
      code = 'calculate-of-aggregate';
    } else if (expressionIsScalar(type.expressionType)) {
      useInstead = 'a group_by or select';
      kind = 'a scalar';
      code = 'calculate-of-scalar';
    } else {
      throw new Error(
        `Unexpected expression type ${type.expressionType} not handled here`
      );
    }
    logTo.logError(
      code,
      `Cannot use ${kind} field in a calculate operation, did you mean to use ${useInstead} operation instead?`
    );
  }
}

export function typecheckAggregate(type: TypeDesc, logTo: MalloyElement) {
  if (type.type === 'turtle' || !expressionIsAggregate(type.expressionType)) {
    let useInstead: string;
    let kind: string;
    let code: MessageCode;
    if (type.type === 'turtle') {
      useInstead = 'a nest';
      kind = 'a view';
      code = 'aggregate-of-view';
    } else if (expressionIsAnalytic(type.expressionType)) {
      useInstead = 'a calculate';
      kind = 'an analytic';
      code = 'aggregate-of-analytic';
    } else if (expressionIsScalar(type.expressionType)) {
      useInstead = 'a group_by or select';
      kind = 'a scalar';
      code = 'aggregate-of-scalar';
    } else {
      throw new Error(`Unexpected expression type ${type} not handled here`);
    }
    logTo.logError(
      code,
      `Cannot use ${kind} field in an aggregate operation, did you mean to use ${useInstead} operation instead?`
    );
  }
}

export function typecheckGroupBy(type: TypeDesc, logTo: MalloyElement) {
  if (type.type === 'turtle' || !expressionIsScalar(type.expressionType)) {
    let useInstead: string;
    let kind: string;
    let code: MessageCode;
    if (type.type === 'turtle') {
      useInstead = 'a nest';
      kind = 'a view';
      code = 'group-by-view';
    } else if (expressionIsAnalytic(type.expressionType)) {
      useInstead = 'a calculate';
      kind = 'an analytic';
      code = 'group-by-analytic';
    } else if (expressionIsAggregate(type.expressionType)) {
      useInstead = 'an aggregate';
      kind = 'an aggregate';
      code = 'group-by-aggregate';
    } else {
      throw new Error(
        `Unexpected expression type ${type.expressionType} not handled here`
      );
    }
    logTo.logError(
      code,
      `Cannot use ${kind} field in a group_by operation, did you mean to use ${useInstead} operation instead?`
    );
  }
}
