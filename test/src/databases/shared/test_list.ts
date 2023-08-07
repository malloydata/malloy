import {RuntimeList} from '../../runtimes';
import {exprSharedTests} from '../all/expr.spec';
import {functionsSharedTests} from '../all/functions.spec';
import {indexSharedTests} from '../all/index.spec';
import {joinSharedTests} from '../all/join.spec';
import {noModelSharedTests} from '../all/nomodel.spec';
import {orderBySharedTests} from '../all/orderby.spec';
import {problemsSharedTests} from '../all/problems.spec';
import {sqlExpressionsSharedTests} from '../all/sql_expressions.spec';
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
