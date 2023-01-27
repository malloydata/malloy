import { Comparison } from "../ast-types";
import { ExprCompare } from "../expression-compare";
import { ExpressionDef } from "./expression-def";

export class Apply extends ExprCompare {
  elementType = "apply";
  constructor(readonly left: ExpressionDef, readonly right: ExpressionDef) {
    super(left, Comparison.EqualTo, right);
  }
}
