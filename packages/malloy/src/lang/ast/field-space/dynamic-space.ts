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
import {SpaceEntry} from '../types/space-entry';
import {ErrorFactory} from '../error-factory';
import {HasParameter} from '../parameters/has-parameter';
import {MalloyElement} from '../types/malloy-element';
import {Join} from '../source-properties/join';
import {SpaceField} from '../types/space-field';
import {JoinSpaceField} from './join-space-field';
import {ViewField} from './view-field';
import {AbstractParameter, SpaceParam} from '../types/space-param';
import {StaticSpace} from './static-space';
import {StructSpaceFieldBase} from './struct-space-field-base';
import {ParameterSpace} from './parameter-space';
import {SourceDef} from '../../../model/malloy_types';
import {SourceFieldSpace} from '../types/field-space';

export abstract class DynamicSpace
  extends StaticSpace
  implements SourceFieldSpace
{
  protected sourceDef: model.SourceDef | undefined;
  protected fromSource: model.SourceDef;
  private complete = false;
  private parameters: HasParameter[] = [];
  protected newTimezone?: string;
  protected newAccessModifiers: (
    | {
        access: model.AccessModifierLabel;
        logTo: MalloyElement;
        fieldName: string;
      }
    | {
        access: model.AccessModifierLabel;
        logTo: MalloyElement;
        except: string[];
      }
  )[] = [];

  constructor(extending: SourceDef) {
    super(structuredClone(extending));
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
      const parameters = {};
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
      const fixupJoins: [Join, model.JoinFieldDef][] = [];
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
          const joinStruct = field.join.structDef(parameterSpace);
          if (!ErrorFactory.didCreate(joinStruct)) {
            fieldIndices.set(name, this.sourceDef.fields.length);
            this.sourceDef.fields.push(joinStruct);
            fixupJoins.push([field.join, joinStruct]);
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

      // If we have join expressions, we need to now go back and fill them in
      for (const [join, missingOn] of fixupJoins) {
        join.fixupJoinOn(this, missingOn);
      }
      // Add access modifiers at the end so views don't obey them
      const existingModifiers = new Map<string, model.AccessModifierLabel>();
      for (const mod of this.newAccessModifiers) {
        if ('fieldName' in mod) {
          const idx = fieldIndices.get(mod.fieldName);
          if (idx !== undefined) {
            this.processAccessModifier(
              mod,
              idx,
              this.sourceDef.fields,
              mod.fieldName,
              existingModifiers
            );
          }
        } else {
          for (const fieldName of fieldIndices.keys()) {
            if (mod.except.indexOf(fieldName) !== -1) continue;
            const idx = fieldIndices.get(fieldName);
            if (idx !== undefined) {
              this.processAccessModifier(
                mod,
                idx,
                this.sourceDef.fields,
                fieldName,
                existingModifiers
              );
            }
          }
        }
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

  private processAccessModifier(
    info: {
      access: model.AccessModifierLabel;
      logTo: MalloyElement;
    },
    idx: number,
    fields: model.FieldDef[],
    name: string,
    existingModifiers: Map<string, model.AccessModifierLabel>
  ) {
    const existing = existingModifiers.get(name);
    if (existing !== undefined && existing !== info.access) {
      info.logTo.logError(
        'conflicting-access-modifier',
        `Access modifier for \`${name}\` was already specified as ${existing}`
      );
      return;
    }
    const fieldDef = fields[idx];
    if (
      (fieldDef.accessModifier === 'private' && info.access === 'internal') ||
      (fieldDef.accessModifier !== undefined && info.access === 'public')
    ) {
      info.logTo.logError(
        'cannot-expand-access',
        `Can't expand access of \`${name}\` from ${fieldDef.accessModifier} to ${info.access}`
      );
    } else {
      const setAccess = info.access === 'public' ? undefined : info.access;
      fields[idx] = {
        ...fieldDef,
        accessModifier: setAccess,
      };
      existingModifiers.set(name, info.access);
    }
  }
}
