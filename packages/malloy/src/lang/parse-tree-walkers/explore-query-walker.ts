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

import {CommonTokenStream} from 'antlr4ts';
import {ParseTree} from 'antlr4ts/tree';
import {ParseTreeWalker} from 'antlr4ts/tree/ParseTreeWalker';
import {MalloyParserListener} from '../lib/Malloy/MalloyParserListener';
// import {
//   ExploreContext,
//   FilterElementContext,
//   FilterListContext,
//   NamedSourceContext,
//   TableSourceContext,
// } from "../lib/Malloy/MalloyParser";

type SimpleRange = [number | undefined, number | undefined];

export interface FilterRef {
  text: string;
  range: SimpleRange;
}

export interface FilterList {
  range: SimpleRange;
}

export interface ExploreRef {
  text: string;
  range: SimpleRange;
}

export interface ExploreClauseRef {
  exploreRef: ExploreRef;
  filterRefs: FilterRef[];
  filterLists: FilterList[];
  range: SimpleRange;
}

export class ExploreQueryWalker implements MalloyParserListener {
  tokens: CommonTokenStream;
  exploreClauseRefs: ExploreClauseRef[];
  currentExploreClauseRef: ExploreClauseRef | undefined;

  constructor(tokens: CommonTokenStream) {
    this.exploreClauseRefs = [];
    this.tokens = tokens;
  }

  exploreQueryAtOffset(offset: number): ExploreClauseRef | undefined {
    return this.exploreClauseRefs.find(ex => {
      if (ex.range[0] === undefined || ex.range[1] === undefined) return false;
      return ex.range[0] <= offset && ex.range[1] >= offset;
    });
  }

  filterAtOffset(offset: number): FilterRef | undefined {
    const exploreRef = this.exploreQueryAtOffset(offset);
    if (!exploreRef) return;
    return exploreRef.filterRefs.find(filterRef => {
      if (filterRef.range[0] === undefined || filterRef.range[1] === undefined)
        return false;
      return filterRef.range[0] <= offset && filterRef.range[1] >= offset;
    });
  }

  hasFilterListAtOffset(offset: number): boolean {
    const exploreRef = this.exploreQueryAtOffset(offset);
    if (!exploreRef) return false;
    return !!exploreRef.filterLists.find(filterList => {
      if (
        filterList.range[0] === undefined ||
        filterList.range[1] === undefined
      )
        return false;
      return filterList.range[0] <= offset && filterList.range[1] >= offset;
    });
  }

  // just to make this compile, no need for this
  inDocument = false;
  enterMalloyDocument(): void {
    this.inDocument = true;
  }

  // enterExplore(pcx: ExploreContext): void {
  //   const exploreRef: ExploreClauseRef = {
  //     exploreRef: {
  //       text: "",
  //       range: [undefined, undefined],
  //     },
  //     filterRefs: [],
  //     filterLists: [],
  //     range: [pcx.start.startIndex, pcx.stop?.stopIndex],
  //   };
  //   this.currentExploreClauseRef = exploreRef;
  //   this.exploreClauseRefs.push(exploreRef);
  // }

  // exitExplore(): void {
  //   this.currentExploreClauseRef = undefined;
  // }

  // enterTableSource(pcx: TableSourceContext): void {
  //   this.setExploreClause(pcx);
  // }

  // enterNamedSource(pcx: NamedSourceContext): void {
  //   this.setExploreClause(pcx);
  // }

  // setExploreClause(pcx: NamedSourceContext | TableSourceContext): void {
  //   if (this.currentExploreClauseRef) {
  //     this.currentExploreClauseRef.exploreRef.text = this.tokens.getText(pcx);
  //     this.currentExploreClauseRef.exploreRef.range = [
  //       pcx.start.startIndex,
  //       pcx.stop?.stopIndex,
  //     ];
  //   }
  // }

  // enterFilterElement(pcx: FilterElementContext): void {
  //   const filterRef: FilterRef = {
  //     text: this.tokens.getText(pcx),
  //     range: [pcx.start.startIndex, pcx.stop?.stopIndex],
  //   };

  //   if (this.currentExploreClauseRef) {
  //     this.currentExploreClauseRef.filterRefs.push(filterRef);
  //   }
  // }

  // enterFilterList(pcx: FilterListContext): void {
  //   const filterList: FilterList = {
  //     range: [pcx.start.startIndex, pcx.stop?.stopIndex],
  //   };

  //   if (this.currentExploreClauseRef) {
  //     this.currentExploreClauseRef.filterLists.push(filterList);
  //   }
  // }
}

export function exploreQueryWalkerBuilder(
  tokens: CommonTokenStream,
  parseTree: ParseTree
): ExploreQueryWalker {
  const finder = new ExploreQueryWalker(tokens);
  const listener: MalloyParserListener = finder;
  ParseTreeWalker.DEFAULT.walk(listener, parseTree);
  return finder;
}
