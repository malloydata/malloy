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
  DocumentLocation,
  PipeSegment,
  Pipeline,
  StructDef
} from "../../../model/malloy_types";

import { FieldSpace } from "../types/field-space";
import { MalloyElement } from "../types/malloy-element";
import { QOPDesc } from "../query-properties/qop-desc";
import { getStructFieldDef, opOutputStruct } from "../struct-utils";
import { QueryInputSpace } from "../field-space/query-spaces";

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
  elementType = "pipelineDesc";
  protected headRefinement?: QOPDesc;
  protected qops: QOPDesc[] = [];
  nestedInQuerySpace?: QueryInputSpace;

  refineHead(refinement: QOPDesc): void {
    this.headRefinement = refinement;
    this.has({ "headRefinement": refinement });
  }

  addSegments(...segDesc: QOPDesc[]): void {
    this.qops.push(...segDesc);
    this.has({ "segments": this.qops });
  }

  protected appendOps(
    modelPipe: PipeSegment[],
    existingEndSpace: FieldSpace
  ): AppendResult {
    let nextFS = existingEndSpace;
    let returnPipe: PipeSegment[] | undefined;
    for (const qop of this.qops) {
      const qopIsNested = modelPipe.length == 0;
      const next = qop.getOp(nextFS, qopIsNested ? this : null);
      if (returnPipe == undefined) {
        returnPipe = [...modelPipe];
      }
      returnPipe.push(next.segment);
      nextFS = next.outputSpace();
    }
    return {
      "opList": returnPipe || modelPipe,
      "structDef": nextFS.structDef()
    };
  }

  protected refinePipeline(fs: FieldSpace, modelPipe: Pipeline): Pipeline {
    if (!this.headRefinement) {
      return modelPipe;
    }
    const pipeline: PipeSegment[] = [];
    if (modelPipe.pipeHead) {
      const { "pipeline": turtlePipe } = this.expandTurtle(
        modelPipe.pipeHead.name,
        fs.structDef()
      );
      pipeline.push(...turtlePipe);
    }
    pipeline.push(...modelPipe.pipeline);
    const firstSeg = pipeline[0];
    if (firstSeg) {
      this.headRefinement.refineFrom(firstSeg);
    }
    pipeline[0] = this.headRefinement.getOp(fs, this).segment;
    return { pipeline };
  }

  protected expandTurtle(
    turtleName: string,
    fromStruct: StructDef
  ): {
    pipeline: PipeSegment[];
    location: DocumentLocation | undefined;
  } {
    const turtle = getStructFieldDef(fromStruct, turtleName);
    if (!turtle) {
      this.log(`Query '${turtleName}' is not defined in source`);
    } else if (turtle.type !== "turtle") {
      this.log(`'${turtleName}' is not a query`);
    } else {
      return { "pipeline": turtle.pipeline, "location": turtle.location };
    }
    return { "pipeline": [], "location": undefined };
  }

  protected getOutputStruct(
    walkStruct: StructDef,
    pipeline: PipeSegment[]
  ): StructDef {
    for (const modelQop of pipeline) {
      walkStruct = opOutputStruct(this, walkStruct, modelQop);
    }
    return walkStruct;
  }
}
