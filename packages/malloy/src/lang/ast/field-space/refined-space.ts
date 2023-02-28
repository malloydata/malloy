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

import {StructDef} from '../../../model/malloy_types';
import {FieldListEdit} from '../source-properties/field-list-edit';
import {RenameField} from '../source-properties/renames';
import {Join} from '../query-properties/joins';
import {DynamicSpace} from './dynamic-space';
import {QueryFieldAST, TurtleDecl} from '../query-properties/nest';
import {FieldDefinitionValue} from './field-definition-value';
import {JoinSpaceField} from './join-space-field';
import {RenameSpaceField} from './rename-space-field';
import {FieldDeclaration} from '../query-items/field-declaration';
import {SpaceField} from '../types/space-field';
import {ExploreField} from '../types/explore-field';

export class RefinedSpace extends DynamicSpace {
  /**
   * Factory for FieldSpace when there are accept/except edits
   * @param from A structdef which seeds this space
   * @param choose A accept/except edit of the "from" fields
   */
  static filteredFrom(from: StructDef, choose?: FieldListEdit): RefinedSpace {
    const edited = new RefinedSpace(from);
    if (choose) {
      const names = choose.refs.list;
      const oldMap = edited.entries();
      edited.dropEntries();
      for (const [symbol, value] of oldMap) {
        const included = !!names.find(f => f.refString === symbol);
        const accepting = choose.edit === 'accept';
        if (included === accepting) {
          edited.setEntry(symbol, value);
        }
      }
    }
    return edited;
  }

  addField(...defs: ExploreField[]): void {
    for (const def of defs) {
      // TODO express the "three fields kinds" in a typesafe way
      // one of three kinds of fields are legal in an explore: expressions ...
      const elseLog = def.log;
      const elseType = def.elementType;
      if (def instanceof FieldDeclaration) {
        const exprField = new FieldDefinitionValue(this, def);
        this.newEntry(exprField.name, def, exprField);
      } else if (def instanceof TurtleDecl) {
        const name = def.name;
        this.newEntry(name, def, new QueryFieldAST(this, def, name));
      } else if (def instanceof RenameField) {
        if (def.oldName.refString === def.newName) {
          def.log("Can't rename field to itself");
          continue;
        }
        const oldValue = def.oldName.getField(this);
        if (oldValue.found) {
          if (oldValue.found instanceof SpaceField) {
            this.setEntry(
              def.newName,
              new RenameSpaceField(oldValue.found, def.newName, def.location)
            );
            this.dropEntry(def.oldName.refString);
          } else {
            def.log(`'${def.oldName}' cannot be renamed`);
          }
        } else {
          def.log(`Can't rename '${def.oldName}', no such field`);
        }
      } else if (def instanceof Join) {
        this.newEntry(def.name.refString, def, new JoinSpaceField(this, def));
      } else {
        elseLog(
          `Internal error: Expected expression, query, or rename, got '${elseType}'`
        );
      }
    }
  }
}
