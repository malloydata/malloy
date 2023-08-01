import {RuntimeList} from '../../runtimes';
import {exprSharedTests} from './expr.spec';
import {functionsSharedTests} from './functions.spec';
import {indexSharedTests} from './index.spec';
import {joinSharedTests} from './join.spec';
import {noModelSharedTests} from './nomodel.spec';
import {orderBySharedTests} from './orderby.spec';
import {problemsSharedTests} from './problems.spec';
import {sqlExpressionsSharedTests} from './sql_expressions.spec';
import {timeSharedTests} from './time.spec';

export type DatabaseTestSet = (runtimeList: RuntimeList) => void;

export const allDatabaseTestSets: DatabaseTestSet[] = [
  exprSharedTests,
  functionsSharedTests,
  indexSharedTests,
  joinSharedTests,
  noModelSharedTests,
  orderBySharedTests,
  problemsSharedTests,
  sqlExpressionsSharedTests,
  timeSharedTests,
];
