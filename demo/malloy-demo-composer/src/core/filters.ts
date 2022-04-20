/*
 * Copyright 2021 Google LLC
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

import {
  BooleanFilter,
  BooleanFilterType,
  NumberFilter,
  NumberFilterType,
  StringFilter,
  StringFilterType,
  TimeFilter,
  TimeFilterType,
} from "../types";

function alternationOf(alternator: "|" | "&", values: string[]): string {
  if (values.length === 0) {
    throw new Error("Alternation must have some values");
  } else {
    return values.join(" " + alternator + " ");
  }
}

export function numberFilterToString(
  field: string,
  filter: NumberFilter
): string {
  switch (filter.type) {
    case "is_equal_to": {
      if (filter.values.length === 0) {
        return `true`;
      }
      return `${field} = ${alternationOf(
        "|",
        filter.values.map((n) => n.toString())
      )}`;
    }
    case "is_not_equal_to": {
      if (filter.values.length === 0) {
        return `true`;
      }
      return `${field} != ${alternationOf(
        "&",
        filter.values.map((n) => n.toString())
      )}`;
    }
    case "is_between":
      return `${field}: ${filter.lowerBound} to ${filter.upperBound}`;
    case "is_greater_than":
      return `${field} > ${filter.value}`;
    case "is_less_than":
      return `${field} < ${filter.value}`;
    case "is_greater_than_or_equal_to":
      return `${field} >= ${filter.value}`;
    case "is_less_than_or_equal_to":
      return `${field} <= ${filter.value}`;
    case "is_null":
      return `${field} = null`;
    case "is_not_null":
      return `${field} != null`;
    case "custom":
      return `${field}: ${filter.partial}`;
  }
}

export function stringFilterToString(
  field: string,
  filter: StringFilter
): string {
  switch (filter.type) {
    case "is_equal_to": {
      if (filter.values.length === 0) {
        return `true`;
      }
      return `${field} = ${alternationOf("|", filter.values.map(quoteString))}`;
    }
    case "is_not_equal_to": {
      if (filter.values.length === 0) {
        return `true`;
      }
      return `${field} != ${alternationOf(
        "&",
        filter.values.map(quoteString)
      )}`;
    }
    case "contains": {
      if (filter.values.length === 0) {
        return `true`;
      }
      return `${field} ~ ${alternationOf(
        "|",
        filter.values
          .map(escapePercents)
          .map((s) => `%${s}%`)
          .map(quoteString)
      )}`;
    }
    case "does_not_contain": {
      if (filter.values.length === 0) {
        return `true`;
      }
      return `${field} !~ ${alternationOf(
        "&",
        filter.values
          .map(escapePercents)
          .map((s) => `%${s}%`)
          .map(quoteString)
      )}`;
    }
    case "starts_with": {
      if (filter.values.length === 0) {
        return `true`;
      }
      return `${field} ~ ${alternationOf(
        "|",
        filter.values
          .map(escapePercents)
          .map((s) => `${s}%`)
          .map(quoteString)
      )}`;
    }
    case "does_not_start_with": {
      if (filter.values.length === 0) {
        return `true`;
      }
      return `${field} !~ ${alternationOf(
        "&",
        filter.values
          .map(escapePercents)
          .map((s) => `${s}%`)
          .map(quoteString)
      )}`;
    }
    case "ends_with": {
      if (filter.values.length === 0) {
        return `true`;
      }
      return `${field} ~ ${alternationOf(
        "|",
        filter.values
          .map(escapePercents)
          .map((s) => `%${s}`)
          .map(quoteString)
      )}`;
    }
    case "does_not_end_with": {
      if (filter.values.length === 0) {
        return `true`;
      }
      return `${field} !~ ${alternationOf(
        "&",
        filter.values
          .map(escapePercents)
          .map((s) => `%${s}`)
          .map(quoteString)
      )}`;
    }
    case "is_null":
      return `${field} = null`;
    case "is_not_null":
      return `${field} != null`;
    case "is_blank":
      return `${field} = ''`;
    case "is_not_blank":
      return `${field} != ''`;
    case "custom":
      return `${field}: ${filter.partial}`;
  }
}

export function booleanFilterToString(
  field: string,
  filter: BooleanFilter
): string {
  switch (filter.type) {
    case "is_false":
      return `not ${field}`;
    case "is_true":
      return `${field}`;
    case "is_true_or_null":
      return `${field}: true | null`;
    case "is_false_or_null":
      return `${field}: false | null`;
    case "is_null":
      return `${field} = null`;
    case "is_not_null":
      return `${field} != null`;
    case "custom":
      return `${field}: ${filter.partial}`;
  }
}

export function timeFilterToString(field: string, filter: TimeFilter): string {
  switch (filter.type) {
    case "is_in_the_past":
      return `${field}: now - ${filter.amount} ${filter.unit} for ${filter.amount} ${filter.unit}`;
    case "is_last":
      return `${field}.${filter.period} = now.${filter.period} - 1 ${filter.period}`;
    case "is_this":
      return `${field}.${filter.period} = now.${filter.period}`;
    case "is_on": {
      return `${field}.${filter.granularity} = ${timeToString(
        filter.date,
        filter.granularity
      )}`;
    }
    case "is_after": {
      return `${field}.${filter.granularity} > ${timeToString(
        filter.date,
        filter.granularity
      )}`;
    }
    case "is_before": {
      return `${field}.${filter.granularity} > ${timeToString(
        filter.date,
        filter.granularity
      )}`;
    }
    case "is_between": {
      return `${field}.${filter.granularity}: ${timeToString(
        filter.start,
        filter.granularity
      )} to ${timeToString(filter.end, filter.granularity)}`;
    }
    case "is_null":
      return `${field} = null`;
    case "is_not_null":
      return `${field} != null`;
    case "custom":
      return `${field}: ${filter.partial}`;
  }
}

function escapePercents(str: string) {
  return str.replace(/%/g, "%%");
}

function quoteString(str: string) {
  // TODO escape quotes
  return `'${str}'`;
}

export function timeToString(
  time: Date,
  timeframe:
    | "year"
    | "quarter"
    | "month"
    | "week"
    | "day"
    | "hour"
    | "minute"
    | "second"
): string {
  switch (timeframe) {
    case "year": {
      const year = digits(time.getUTCFullYear(), 4);
      return `@${year}`;
    }
    case "quarter": {
      const year = digits(time.getUTCFullYear(), 4);
      const quarter = Math.floor(time.getUTCMonth() / 3) + 1;
      return `@${year}-Q${quarter}`;
    }
    case "month": {
      const year = digits(time.getUTCFullYear(), 2);
      const month = digits(time.getUTCMonth() + 1, 2);
      return `@${year}-${month}`;
    }
    case "week": {
      const year = digits(time.getUTCFullYear(), 2);
      const month = digits(time.getUTCMonth() + 1, 2);
      const day = digits(time.getUTCDate(), 2);
      return `@WK${year}-${month}-${day}`;
    }
    case "day": {
      const year = digits(time.getUTCFullYear(), 2);
      const month = digits(time.getUTCMonth() + 1, 2);
      const day = digits(time.getUTCDate(), 2);
      return `@${year}-${month}-${day}`;
    }
    case "hour": {
      const year = digits(time.getUTCFullYear(), 2);
      const month = digits(time.getUTCMonth() + 1, 2);
      const day = digits(time.getUTCDate(), 2);
      const hour = digits(time.getUTCHours(), 2);
      return `@${year}-${month}-${day} ${hour}:00 for 1 hour`;
    }
    case "minute": {
      const year = digits(time.getUTCFullYear(), 2);
      const month = digits(time.getUTCMonth() + 1, 2);
      const day = digits(time.getUTCDate(), 2);
      const hour = digits(time.getUTCHours(), 2);
      const minute = digits(time.getUTCMinutes(), 2);
      return `@${year}-${month}-${day} ${hour}:${minute}`;
    }
    case "second": {
      const year = digits(time.getUTCFullYear(), 2);
      const month = digits(time.getUTCMonth() + 1, 2);
      const day = digits(time.getUTCDate(), 2);
      const hour = digits(time.getUTCHours(), 2);
      const minute = digits(time.getUTCMinutes(), 2);
      const second = digits(time.getUTCSeconds(), 2);
      return `@${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }
    default:
      throw new Error("Unknown timeframe.");
  }
}

function digits(value: number, digits: number) {
  return value.toString().padStart(digits, "0");
}

export function stringFilterChangeType(
  filter: StringFilter,
  type: StringFilterType
): StringFilter {
  switch (type) {
    case "is_equal_to":
    case "is_not_equal_to":
    case "starts_with":
    case "does_not_start_with":
    case "contains":
    case "does_not_contain":
    case "ends_with":
    case "does_not_end_with":
      return { type, values: "values" in filter ? filter.values : [] };
    case "is_blank":
    case "is_not_blank":
    case "is_null":
    case "is_not_null":
      return { type };
    case "custom":
      // TODO extract the partial and fill it in here
      return { type, partial: "" };
  }
}

export function numberFilterChangeType(
  filter: NumberFilter,
  type: NumberFilterType
): NumberFilter {
  switch (type) {
    case "is_equal_to":
    case "is_not_equal_to":
      return {
        type,
        values:
          "values" in filter
            ? filter.values
            : "value" in filter
            ? [filter.value]
            : "lowerBound" in filter
            ? [filter.lowerBound]
            : [],
      };
    case "is_greater_than":
    case "is_less_than":
    case "is_greater_than_or_equal_to":
    case "is_less_than_or_equal_to":
      return {
        type,
        value:
          "value" in filter
            ? filter.value
            : "values" in filter
            ? filter.values[0] || 0
            : 0,
      };
    case "is_between":
      return {
        type,
        lowerBound:
          "value" in filter
            ? filter.value
            : "values" in filter
            ? filter.values[0] || 0
            : 0,
        upperBound: 0,
      };
    case "is_null":
    case "is_not_null":
      return { type };
    case "custom":
      // TODO extract the partial and fill it in here
      return { type, partial: "" };
  }
}

export function timeFilterChangeType(
  filter: TimeFilter,
  type: TimeFilterType
): TimeFilter {
  switch (type) {
    case "is_in_the_past":
      return { type, unit: "days", amount: 7 };
    case "is_last":
    case "is_this":
      return { type, period: "day", amount: 1 };
    case "is_on":
    case "is_after":
    case "is_before":
      return {
        type,
        granularity: "granularity" in filter ? filter.granularity : "day",
        date:
          "date" in filter
            ? filter.date
            : "start" in filter
            ? filter.start
            : new Date(),
      };
    case "is_between":
      return {
        type,
        granularity: "granularity" in filter ? filter.granularity : "day",
        start: "date" in filter ? filter.date : new Date(),
        end: new Date(),
      };
    case "is_null":
    case "is_not_null":
      return { type };
    case "custom":
      // TODO extract the partial and fill it in here
      return { type, partial: "" };
  }
}

export function booleanFilterChangeType(
  filter: BooleanFilter,
  type: BooleanFilterType
): BooleanFilter {
  switch (type) {
    case "custom":
      // TODO extract the partial and fill it in here
      return { type, partial: "" };
    default:
      return { type };
  }
}
