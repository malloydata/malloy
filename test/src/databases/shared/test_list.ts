import {indexSharedTests} from './db_index';
import {RuntimeList} from '../../runtimes';
import {exprSharedTests} from './expr';
import {functionsSharedTests} from './functions';
import {joinSharedTests} from './join';
import {noModelSharedTests} from './nomodel';
import {orderBySharedTests} from './orderby';
import {problemsSharedTests} from './problems';
import {sqlExpressionsSharedTests} from './sql_expressions';
import {timeSharedTests} from './time';

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
