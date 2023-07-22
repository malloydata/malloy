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
} from '../../../model/malloy_types';

import {FieldName, FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {QOPDesc} from '../query-properties/qop-desc';
import {getStructFieldDef, opOutputStruct} from '../struct-utils';
import {QueryInputSpace} from '../field-space/query-input-space';
import {LegalRefinementStage} from '../types/query-property-interface';
import {StaticSpace} from '../field-space/static-space';

interface AppendResult {
  opList: PipeSegment[];
  structDef: StructDef;
}

/**
 * Generic abstract for all pipelines, the first segment might be a reference
 * to an existing pipeline (query or turtle), and if there is a refinement it
 * is refers to the first segment of the composed pipeline.
 */
export abstract class PipelineDesc extends MalloyElement {
  protected withRefinement?: QOPDesc;
  protected qops: QOPDesc[] = [];
  nestedInQuerySpace?: QueryInputSpace;

  refineWith(refinement: QOPDesc): void {
    this.withRefinement = refinement;
    this.has({withRefinement: refinement});
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
    const nestedIn =
      modelPipe.length === 0 ? this.nestedInQuerySpace : undefined;
    let nextFS = pipelineOutput;
    for (const qop of this.qops) {
      const next = qop.getOp(nextFS, nestedIn);
      returnPipe.push(next.segment);
      nextFS = next.outputSpace();
    }
    return {
      opList: returnPipe,
      structDef: nextFS.structDef(),
    };
  }

  private refineSegment(
    fs: FieldSpace,
    refinement: QOPDesc,
    seg: PipeSegment
  ): PipeSegment {
    refinement.refineFrom(seg);
    return refinement.getOp(fs, this.nestedInQuerySpace).segment;
  }

  protected refinePipeline(fs: FieldSpace, modelPipe: Pipeline): Pipeline {
    if (!this.withRefinement) {
      return modelPipe;
    }
    let pipeline: PipeSegment[] = [];
    if (modelPipe.pipeHead) {
      const {pipeline: turtlePipe} = this.expandTurtle(
        modelPipe.pipeHead.name,
        fs.structDef()
      );
      pipeline.push(...turtlePipe);
    }
    pipeline.push(...modelPipe.pipeline);
    const firstSeg = pipeline[0];
    if (pipeline.length === 1) {
      // I could let everything fall through to the head/tail case, it should be the
      // same, but this does less computation and is the most common case.
      pipeline = [this.refineSegment(fs, this.withRefinement, firstSeg)];
      this.withRefinement = undefined;
    } else {
      const headRefinements = new QOPDesc([]);
      const tailRefinements = new QOPDesc([]);
      for (const qop of this.withRefinement.list) {
        switch (qop.queryRefinementStage) {
          case LegalRefinementStage.Head:
            headRefinements.push(qop);
            break;
          case LegalRefinementStage.Single:
            qop.log('Illegal in refinment of a query with more than one stage');
            break;
          case LegalRefinementStage.Tail:
            tailRefinements.push(qop);
            break;
          default:
            qop.log('Illegal query refinement');
        }
      }
      if (headRefinements.notEmpty()) {
        this.has({headRefinements});
        pipeline[0] = this.refineSegment(fs, headRefinements, firstSeg);
      }
      if (tailRefinements.notEmpty()) {
        const last = pipeline.length - 1;
        this.has({tailRefinements});
        const finalIn = this.getFinalStruct(fs.structDef(), pipeline.slice(-1));
        pipeline[last] = this.refineSegment(
          new StaticSpace(finalIn),
          tailRefinements,
          pipeline[last]
        );
      }
    }
    this.withRefinement = undefined;
    return {pipeline};
  }

  protected expandTurtle(
    turtleName: string,
    fromStruct: StructDef
  ): {
    pipeline: PipeSegment[];
    location: DocumentLocation | undefined;
    annotation: Annotation | undefined;
  } {
    const turtle = getStructFieldDef(fromStruct, turtleName);
    let annotation: Annotation | undefined;
    if (!turtle) {
      this.log(`Query '${turtleName}' is not defined in source`);
    } else if (turtle.type !== 'turtle') {
      this.log(`'${turtleName}' is not a query`);
    } else {
      if (turtle.annotation) {
        annotation = {inherits: turtle.annotation};
      }
      return {pipeline: turtle.pipeline, location: turtle.location, annotation};
    }
    return {pipeline: [], location: undefined, annotation};
  }

  protected getFinalStruct(
    walkStruct: StructDef,
    pipeline: PipeSegment[]
  ): StructDef {
    for (const modelQop of pipeline) {
      walkStruct = opOutputStruct(this, walkStruct, modelQop);
    }
    return walkStruct;
  }
}

export abstract class TurtleHeadedPipe extends PipelineDesc {
  _turtleName?: FieldName;

  set turtleName(turtleName: FieldName | undefined) {
    this._turtleName = turtleName;
    this.has({turtleName: turtleName});
  }

  get turtleName(): FieldName | undefined {
    return this._turtleName;
  }
}
