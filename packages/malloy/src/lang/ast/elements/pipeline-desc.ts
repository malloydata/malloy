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
  DocumentLocation,
  PipeSegment,
  Pipeline,
  StructDef,
  isAtomicField,
  isTurtleDef,
} from '../../../model/malloy_types';

import {FieldName, FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {QOPDesc} from '../query-properties/qop-desc';
import {QuerySpace} from '../field-space/query-spaces';
import {ViewFieldReference} from '../query-items/field-references';
import {Refinement} from '../query-properties/refinements';
import {StaticSpace} from '../field-space/static-space';
import {SpaceField} from '../types/space-field';

interface AppendResult {
  opList: PipeSegment[];
  structDef: () => StructDef;
}

/**
 * Generic abstract for all pipelines, the first segment might be a reference
 * to an existing pipeline (query or turtle), and if there is a refinement it
 * is refers to the first segment of the composed pipeline.
 */
export abstract class PipelineDesc extends MalloyElement {
  protected refinements?: Refinement[];
  protected qops: QOPDesc[] = [];
  private isNestIn?: QuerySpace;

  /**
   * This pipeline is actually a nest statement, and the passed query space
   * is the space for the query which contains the nest statement. This is
   * used so that nest queries can walk up a nest chain to check
   * "ungrouping" expressions.
   *
   * This is only here so that it can be used when a Builder is created
   * so the query space created by the builder can also know that it is
   * nested.
   */
  declareAsNestInside(qs: QuerySpace) {
    this.isNestIn = qs;
  }

  alreadyRefined(): boolean {
    return this.refinements !== undefined;
  }

  refineWith(refinements: (QOPDesc | ViewFieldReference)[]): void {
    const ref = refinements.map(refinement => Refinement.from(refinement));
    this.refinements = ref;
    this.has({refinements: ref});
  }

  addSegments(...segDesc: QOPDesc[]): void {
    this.qops.push(...segDesc);
    this.has({segments: this.qops});
  }

  protected appendOps(
    pipelineOutput: FieldSpace,
    modelPipe: PipeSegment[]
  ): AppendResult {
    const returnPipe: PipeSegment[] = [...modelPipe];
    const nestedIn = modelPipe.length === 0 ? this.isNestIn : undefined;
    let nextFS = () => pipelineOutput;
    for (const qop of this.qops) {
      const next = qop.getOp(nextFS(), nestedIn);
      returnPipe.push(next.segment);
      nextFS = () => next.outputSpace();
    }
    return {
      opList: returnPipe,
      structDef: () => nextFS().structDef(),
    };
  }

  protected refinePipeline(fs: FieldSpace, modelPipe: Pipeline): Pipeline {
    if (!this.refinements) {
      return modelPipe;
    }
    let pipeline: PipeSegment[] = [];
    if (modelPipe.pipeHead) {
      const ref = new ViewFieldReference([
        new FieldName(modelPipe.pipeHead.name),
      ]);
      this.has({ref});
      const {pipeline: turtlePipe} = this.expandTurtle(ref, fs.structDef());
      pipeline.push(...turtlePipe);
    }
    pipeline.push(...modelPipe.pipeline);
    for (const refinement of this.refinements) {
      pipeline = refinement.refine(fs, pipeline, this.isNestIn);
    }
    return {pipeline};
  }

  protected expandTurtle(
    turtleName: ViewFieldReference,
    fromStruct: StructDef
  ): {
    needsExpansionDueToScalar: boolean;
    pipeline: PipeSegment[];
    location: DocumentLocation | undefined;
    annotation: Annotation | undefined;
  } {
    const fs = new StaticSpace(fromStruct);
    const lookup = turtleName.getField(fs);
    let annotation: Annotation | undefined;
    if (!lookup.found) {
      this.log(`Query '${turtleName}' is not defined in source`);
    } else if (lookup.found instanceof SpaceField) {
      const fieldDef = lookup.found.fieldDef();
      if (fieldDef && isAtomicField(fieldDef)) {
        if (this.inExperiment('scalar_lenses', true)) {
          return {
            needsExpansionDueToScalar: true,
            pipeline: [
              {
                type: 'reduce',
                fields: [
                  {
                    type: fieldDef.type,
                    name: fieldDef.as ?? fieldDef.name,
                    expressionType: fieldDef.expressionType,
                    e: [{type: 'field', path: turtleName.refString}],
                  },
                ],
              },
            ],
            location: fieldDef.location,
            annotation,
          };
        } else {
          this.log(`'${turtleName.refString}' is not a query`);
        }
      } else if (turtleName.list.length > 1) {
        this.log('Cannot use view from join');
      } else if (fieldDef && isTurtleDef(fieldDef)) {
        if (fieldDef.annotation) {
          annotation = {inherits: fieldDef.annotation};
        }
        return {
          pipeline: fieldDef.pipeline,
          location: fieldDef.location,
          annotation,
          needsExpansionDueToScalar: false,
        };
      }
    }
    return {
      pipeline: [],
      location: undefined,
      annotation,
      needsExpansionDueToScalar: false,
    };
  }
}

export abstract class TurtleHeadedPipe extends PipelineDesc {
  _turtleName?: ViewFieldReference;

  set turtleName(turtleName: ViewFieldReference | undefined) {
    this._turtleName = turtleName;
    this.has({turtleName: turtleName});
  }

  get turtleName(): ViewFieldReference | undefined {
    return this._turtleName;
  }
}
