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

import { isNestedQuery } from "./ast-main";
import { FieldListEdit } from "./explore-properties/field-list-edit";
import { PrimaryKey } from "./explore-properties/primary-key";
import { Renames } from "./explore-properties/renames";
import { Turtles } from "./explore-properties/turtles";
import { MalloyElement } from "./malloy-element";
import { Aggregate } from "./query-properties/aggregate";
import { DeclareFields } from "./query-properties/declare-fields";
import { Filter } from "./query-properties/filters";
import { GroupBy } from "./query-properties/group-by";
import { Index } from "./query-properties/indexing";
import { Joins } from "./query-properties/joins";
import { Limit } from "./query-properties/limit";
import { Nests } from "./query-properties/nests";
import { Ordering } from "./query-properties/ordering";
import { ProjectStatement } from "./query-properties/project-statement";
import { SampleProperty } from "./query-properties/sampling";
import { Top } from "./query-properties/top";
import { ExploreProperty } from "./types/explore-property";
import { QueryProperty } from "./types/query-property";

export function isExploreProperty(p: MalloyElement): p is ExploreProperty {
  return (
    p instanceof Filter ||
    p instanceof Joins ||
    p instanceof DeclareFields ||
    p instanceof FieldListEdit ||
    p instanceof Renames ||
    p instanceof PrimaryKey ||
    p instanceof Turtles
  );
}

export function isQueryProperty(q: MalloyElement): q is QueryProperty {
  return (
    q instanceof Ordering ||
    q instanceof Top ||
    q instanceof Limit ||
    q instanceof Filter ||
    q instanceof Index ||
    q instanceof SampleProperty ||
    q instanceof Joins ||
    q instanceof DeclareFields ||
    q instanceof ProjectStatement ||
    q instanceof Aggregate ||
    q instanceof Nests ||
    isNestedQuery(q) ||
    q instanceof GroupBy
  );
}
