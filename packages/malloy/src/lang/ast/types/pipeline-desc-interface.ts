import {QueryInputSpace} from '../field-space/query-spaces';

/**
 * This is a list of things that QOPDesc needs to know about PiplienDesc
 * so that it doesn't need to import PipelineDesc
 */
export interface PipelineDescInterface {
  nestedInQuerySpace?: QueryInputSpace;
}
