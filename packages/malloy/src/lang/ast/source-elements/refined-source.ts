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

import {
  Annotation,
  SourceDef,
  expressionIsCalculation,
} from '../../../model/malloy_types';

import {RefinedSpace} from '../field-space/refined-space';
import {HasParameter} from '../parameters/has-parameter';
import {DeclareFields} from '../query-properties/declare-fields';
import {Filter} from '../query-properties/filters';
import {FieldListEdit} from '../source-properties/field-list-edit';
import {PrimaryKey} from '../source-properties/primary-key';
import {Views} from '../source-properties/views';
import {SourceDesc} from '../types/source-desc';
import {Source} from './source';
import {TimezoneStatement} from '../source-properties/timezone-statement';
import {ObjectAnnotation} from '../types/annotation-elements';
import {Renames} from '../source-properties/renames';
import {MakeEntry} from '../types/space-entry';
import {ParameterSpace} from '../field-space/parameter-space';
import {JoinStatement} from '../source-properties/join';

/**
 * A Source made from a source reference and a set of refinements
 */
export class RefinedSource extends Source {
  elementType = 'refinedSource';
  currentAnnotation?: Annotation;

  constructor(
    readonly source: Source,
    readonly refinement: SourceDesc
  ) {
    super({source, refinement});
  }

  getSourceDef(parameterSpace: ParameterSpace | undefined): SourceDef {
    return this.withParameters(parameterSpace, []);
  }

  withParameters(
    parameterSpace: ParameterSpace | undefined,
    pList: HasParameter[] | undefined
  ): SourceDef {
    let primaryKey: PrimaryKey | undefined;
    let fieldListEdit: FieldListEdit | undefined;
    const fields: MakeEntry[] = [];
    const filters: Filter[] = [];
    let newTimezone: string | undefined;

    for (const el of this.refinement.list) {
      if (el instanceof ObjectAnnotation) {
        // Treat lone annotations as comments
        continue;
      }
      const errTo = el;
      if (el instanceof PrimaryKey) {
        if (primaryKey) {
          const code = 'multiple-primary-keys';
          primaryKey.logError(code, 'Primary key already defined');
          el.logError(code, 'Primary key redefined');
        }
        primaryKey = el;
      } else if (el instanceof FieldListEdit) {
        if (fieldListEdit) {
          const code = 'multiple-field-list-edits';
          fieldListEdit.logError(code, 'Too many accept/except statements');
          el.logError(code, 'Too many accept/except statements');
        }
        fieldListEdit = el;
      } else if (
        el instanceof DeclareFields ||
        el instanceof JoinStatement ||
        el instanceof Views ||
        el instanceof Renames
      ) {
        fields.push(...el.list);
      } else if (el instanceof Filter) {
        filters.push(el);
      } else if (el instanceof TimezoneStatement) {
        newTimezone = el.tz;
      } else {
        errTo.logError(
          'unexpected-source-property',
          `Unexpected source property: '${errTo.elementType}'`
        );
      }
    }

    const paramSpace = pList ? new ParameterSpace(pList) : undefined;
    const from = structuredClone(this.source.getSourceDef(paramSpace));
    // Note that this is explicitly not:
    // const from = structuredClone(this.source.withParameters(parameterSpace, pList));
    // Because the parameters are added to the resulting struct, not the base struct
    if (primaryKey) {
      from.primaryKey = primaryKey.field.name;
    }
    const fs = RefinedSpace.filteredFrom(from, fieldListEdit, paramSpace);
    if (newTimezone) {
      fs.setTimezone(newTimezone);
    }
    if (pList) {
      fs.addParameters(pList);
    }
    fs.pushFields(...fields);
    if (primaryKey) {
      const keyDef = primaryKey.field.getField(fs);
      if (keyDef.error) {
        primaryKey.logError(keyDef.error.code, keyDef.error.message);
      }
    }
    const retStruct = fs.structDef();

    const filterList = retStruct.filterList || [];
    let moreFilters = false;
    for (const filter of filters) {
      for (const el of filter.list) {
        const fc = el.filterCondition(fs);
        if (expressionIsCalculation(fc.expressionType)) {
          el.logError(
            'aggregate-in-source-filter',
            "Can't use aggregate computations in top level filters"
          );
        } else {
          filterList.push(fc);
          moreFilters = true;
        }
      }
    }
    if (moreFilters) {
      return {...retStruct, filterList};
    }
    this.document()?.rememberToAddModelAnnotations(retStruct);
    return retStruct;
  }
}
