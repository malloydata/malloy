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

import * as model from '../../../model/malloy_types';
import {nameFromDef} from '../../field-utils';
import type {SpaceEntry} from '../types/space-entry';
import {ErrorFactory} from '../error-factory';
import type {HasParameter} from '../parameters/has-parameter';
import type {MalloyElement} from '../types/malloy-element';
import {SpaceField} from '../types/space-field';
import {JoinSpaceField} from './join-space-field';
import {ViewField} from './view-field';
import {AbstractParameter, SpaceParam} from '../types/space-param';
import {StaticSpace} from './static-space';
import {StructSpaceFieldBase} from './struct-space-field-base';
import {ParameterSpace} from './parameter-space';
import type {SourceDef} from '../../../model/malloy_types';
import type {SourceFieldSpace} from '../types/field-space';

export abstract class DynamicSpace
  extends StaticSpace
  implements SourceFieldSpace
{
  protected sourceDef: model.SourceDef | undefined;
  protected fromSource: model.SourceDef;
  private complete = false;
  private parameters: HasParameter[] = [];
  protected newTimezone?: string;
  protected newAccessModifiers = new Map<string, model.AccessModifierLabel>();
  protected newNotes = new Map<string, model.Annotation>();

  constructor(extending: SourceDef) {
    super({...extending}, extending.dialect, extending.connection);
    this.fromSource = extending;
    this.sourceDef = undefined;
  }

  protected setEntry(name: string, value: SpaceEntry): void {
    if (this.complete) {
      throw new Error('Space already final');
    }
    super.setEntry(name, value);
  }

  addParameters(parameters: HasParameter[]): DynamicSpace {
    for (const parameter of parameters) {
      if (this.entry(parameter.name) === undefined) {
        this.parameters.push(parameter);
        this.setEntry(parameter.name, new AbstractParameter(parameter));
      }
    }
    return this;
  }

  parameterSpace(): ParameterSpace {
    return new ParameterSpace(this.parameters);
  }

  newEntry(name: string, logTo: MalloyElement, entry: SpaceEntry): void {
    if (this.entry(name)) {
      logTo.logError('definition-name-conflict', `Cannot redefine '${name}'`);
      return;
    }
    this.setEntry(name, entry);
  }

  renameEntry(oldName: string, newName: string, entry: SpaceEntry) {
    this.dropEntry(oldName);
    this.setEntry(newName, entry);
  }

  addFieldDef(fd: model.FieldDef): void {
    this.setEntry(nameFromDef(fd), this.defToSpaceField(fd));
  }

  setTimezone(tz: string): void {
    this.newTimezone = tz;
  }

  structDef(): model.SourceDef {
    this.complete = true;
    if (this.sourceDef === undefined) {
      // Grab all the parameters so that we can populate the "final" structDef
      // with parameters immediately so that views can see them when they are translating
      const parameters: Record<string, model.Parameter> = Object.create(null);
      for (const [name, entry] of this.entries()) {
        if (entry instanceof SpaceParam) {
          parameters[name] = entry.parameter();
        }
      }

      this.sourceDef = {...this.fromSource, fields: []};
      this.sourceDef.parameters = parameters;
      const fieldIndices = new Map<string, number>();
      // Need to process the entities in specific order
      const fields: [string, SpaceField][] = [];
      const joins: [string, SpaceField][] = [];
      const turtles: [string, SpaceField][] = [];
      for (const [name, spaceEntry] of this.entries()) {
        if (spaceEntry instanceof StructSpaceFieldBase) {
          joins.push([name, spaceEntry]);
        } else if (spaceEntry instanceof ViewField) {
          turtles.push([name, spaceEntry]);
        } else if (spaceEntry instanceof SpaceField) {
          fields.push([name, spaceEntry]);
        }
      }
      const reorderFields = [...fields, ...joins, ...turtles];
      const parameterSpace = this.parameterSpace();
      for (const [name, field] of reorderFields) {
        if (field instanceof JoinSpaceField) {
          const joinStruct = field.join.getStructDef(parameterSpace);
          if (!ErrorFactory.didCreate(joinStruct)) {
            fieldIndices.set(name, this.sourceDef.fields.length);
            this.sourceDef.fields.push(joinStruct);
            field.join.fixupJoinOn(this, joinStruct);
          }
        } else {
          const fieldDef = field.fieldDef();
          if (fieldDef) {
            fieldIndices.set(name, this.sourceDef.fields.length);
            this.sourceDef.fields.push(fieldDef);
          }
          // TODO I'm just removing this, but perhaps instead I should just filter
          // out ReferenceFields and still make this check.
          // else {
          //   throw new Error(`'${fieldName}' doesn't have a FieldDef`);
          // }
        }
      }
      // Add access modifiers at the end so views don't obey them
      for (const [name, access] of this.newAccessModifiers) {
        const index = this.sourceDef.fields.findIndex(
          f => (f.as ?? f.name) === name
        );
        if (index === -1) {
          throw new Error(`Can't find field '${name}' to set access modifier`);
        }
        if (access === 'public') {
          delete this.sourceDef.fields[index].accessModifier;
        } else {
          this.sourceDef.fields[index] = {
            ...this.sourceDef.fields[index],
            accessModifier: access,
          };
        }
      }
      // TODO does this need to be done when the space is instantiated?
      // e.g. if a field had a compiler flag on it...
      for (const [name, note] of this.newNotes) {
        const index = this.sourceDef.fields.findIndex(
          f => f.as ?? f.name === name
        );
        if (index === -1) {
          throw new Error(`Can't find field '${name}' to set access modifier`);
        }
        const field = this.sourceDef.fields[index];
        this.sourceDef.fields[index] = {
          ...field,
          annotation: {
            ...note,
            inherits: field.annotation,
          },
        };
      }
    }
    if (this.newTimezone && model.isSourceDef(this.sourceDef)) {
      this.sourceDef.queryTimezone = this.newTimezone;
    }
    return this.sourceDef;
  }

  emptyStructDef(): SourceDef {
    const ret = {...this.fromSource};
    ret.fields = [];
    return ret;
  }
}
