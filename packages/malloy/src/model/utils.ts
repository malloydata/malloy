/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

/** simple indent function */
export function indent(s: string): string {
  const re = /(^|\n)/g;
  const lastNewline = /\n {2}$/;
  return s.replace(re, "$1  ").replace(lastNewline, "\n");
}

/**
 * Generate a SQL string literal from a given `input` string, safe, e.g., to be used in `WHERE` clauses.
 */
export function generateSQLStringLiteral(input: string): string {
  const escapedString = input.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${escapedString}'`;
}

/**
 * WHERE and HAVING clauses are built out of a chain of boolean experssions
 * joined with AND.
 */
export class AndChain {
  private clauses: string[] = [];
  constructor(intial?: string) {
    if (intial) {
      this.clauses.push(intial);
    }
  }

  clone(): AndChain {
    const theClone = new AndChain();
    theClone.addChain(this);
    return theClone;
  }

  add(clause: string): AndChain {
    this.clauses.push(clause);
    return this;
  }

  addChain(andChain: AndChain): AndChain {
    this.clauses.push(...andChain.clauses);
    return this;
  }

  empty(): boolean {
    return this.clauses.length === 0;
  }

  present(): boolean {
    return this.clauses.length > 0;
  }

  sqlOr(): string {
    if (this.empty()) {
      return "";
    }
    return this.clauses.map((c) => `(${c})`).join("OR ") + "\n";
  }

  sql(whereOrHaving?: "where" | "having"): string {
    if (this.empty()) {
      return "";
    }

    let prefix = "";
    let postfix = "";
    if (whereOrHaving) {
      prefix = whereOrHaving.toUpperCase() + " ";
      postfix = "\n";
    }
    if (this.clauses.length === 1) {
      return prefix + this.clauses[0] + postfix;
    }
    return prefix + this.clauses.map((c) => `(${c})`).join("\nAND ") + postfix;
  }
}
