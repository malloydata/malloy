/**
 * Unlike a source, which is a refinement of a namespace, a query
 * is creating a new unrelated namespace. The query starts with a
 * source, which it might modify. This set of fields used to resolve
 * expressions in the query is called the "input space". There is a
 * specialized QuerySpace for each type of query operation.
 */

import {FieldDeclaration} from '../query-items/field-declaration';
import {Join} from '../query-properties/joins';
import {SourceSpec, SpaceSeed} from '../space-seed';
import {FieldSpace} from '../types/field-space';
import {RefinedSpace} from './refined-space';

export class QueryInputSpace extends RefinedSpace {
  nestParent?: QueryInputSpace;
  extendList: string[] = [];

  /**
   * Because of circularity concerns this constructor is not typed
   * properly ...
   * @param input The source which might be extended
   * @param queryOutput MUST BE A QuerySpace
   */
  constructor(input: SourceSpec, private queryOutput: FieldSpace) {
    const inputSpace = new SpaceSeed(input);
    super(inputSpace.structDef);
  }

  extendSource(extendField: Join | FieldDeclaration): void {
    this.pushFields(extendField);
    if (extendField instanceof Join) {
      this.extendList.push(extendField.name.refString);
    } else {
      this.extendList.push(extendField.defineName);
    }
  }

  isQueryFieldSpace() {
    return true;
  }

  outputSpace() {
    return this.queryOutput;
  }
}
