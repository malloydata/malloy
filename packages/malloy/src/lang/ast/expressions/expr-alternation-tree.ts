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

import {maxExpressionType, mergeEvalSpaces} from '../../../model/malloy_types';
import {ExprValue} from '../types/expr-value';
import {FieldSpace} from '../types/field-space';
import {ATNodeType, ExpressionDef} from '../types/expression-def';
import {BinaryMalloyOperator, isEquality} from '../types/binary_operators';

/**
 * Return a flattened version of an alternation tree, if the tree is
 * composed entirely values and "or"s.
 *
 * @param node Root of the tree
 * @returns Undefined if other nodes are found in the tree
 */
function flattenOrTree(inNode: ExpressionDef): ExpressionDef[] | undefined {
  const node = inNode.atExpr();
  switch (node.atNodeType()) {
    case ATNodeType.And:
    case ATNodeType.Partial:
      return undefined;
    case ATNodeType.Or: {
      if (node instanceof ExprAlternationTree) {
        const left = flattenOrTree(node.left);
        if (left) {
          const right = flattenOrTree(node.right);
          if (right) {
            return [...left, ...right];
          }
        }
      }
      return undefined;
    }
    default:
      return node.granular() ? undefined : [node];
  }
}

export class ExprAlternationTree extends ExpressionDef {
  elementType = 'alternation';
  inList?: ExpressionDef[];
  constructor(
    readonly left: ExpressionDef,
    readonly op: '|' | '&',
    readonly right: ExpressionDef
  ) {
    super({left, right});
    this.elementType = `${op}alternation${op}`;
  }

  equalityList(): ExpressionDef[] {
    if (this.inList === undefined) {
      this.inList = flattenOrTree(this) || [];
    }
    return this.inList;
  }

  apply(
    fs: FieldSpace,
    applyOp: BinaryMalloyOperator,
    expr: ExpressionDef,
    warnOnComplexTree: boolean
  ): ExprValue {
    if (isEquality(applyOp)) {
      const inList = this.equalityList();
      if (inList.length > 0 && (applyOp === '=' || applyOp === '!=')) {
        const isIn = expr.getExpression(fs);
        const values = inList.map(v => v.getExpression(fs));
        let {evalSpace, expressionType} = isIn;
        for (const value of values) {
          evalSpace = mergeEvalSpaces(evalSpace, value.evalSpace);
          expressionType = maxExpressionType(
            expressionType,
            value.expressionType
          );
        }
        return {
          dataType: 'boolean',
          evalSpace,
          expressionType,
          value: {
            node: 'in',
            not: applyOp === '!=',
            kids: {e: isIn.value, oneOf: values.map(v => v.value)},
          },
        };
      }
      if (inList.length === 0 && warnOnComplexTree) {
        this.logWarning(
          'or-choices-only',
          `Only | seperated values are legal when used with ${applyOp} operator`
        );
      }
    }
    const choice1 = this.left.apply(fs, applyOp, expr);
    const choice2 = this.right.apply(fs, applyOp, expr);
    return {
      dataType: 'boolean',
      expressionType: maxExpressionType(
        choice1.expressionType,
        choice2.expressionType
      ),
      evalSpace: mergeEvalSpaces(choice1.evalSpace, choice2.evalSpace),
      value: {
        node: this.op === '&' ? 'and' : 'or',
        kids: {left: choice1.value, right: choice2.value},
      },
    };
  }

  requestExpression(_fs: FieldSpace): ExprValue | undefined {
    return undefined;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.loggedErrorExpr(
      'alternation-as-value',
      'Alternation tree has no value'
    );
  }

  atNodeType(): ATNodeType {
    return this.op === '|' ? ATNodeType.Or : ATNodeType.And;
  }
}
