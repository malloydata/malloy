import {RuntimeList} from '../../runtimes';

export type DatabaseTestSet = (runtimeList: RuntimeList) => void;

export const allDatabaseTestSets: DatabaseTestSet[] = [];
