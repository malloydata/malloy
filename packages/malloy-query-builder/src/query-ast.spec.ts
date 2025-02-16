import {ASTQuery} from './query-ast';
// eslint-disable-next-line node/no-extraneous-import
import * as Malloy from '@malloydata/malloy-interfaces';

const flights_model: Malloy.ModelInfo = {
  entries: [
    {
      __type: Malloy.ModelEntryValueType.Source,
      name: 'aircraft_models',
      schema: {
        fields: [
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'aircraft_model_code',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'manufacturer',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'model',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'aircraft_type_id',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'aircraft_engine_type_id',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'aircraft_category_id',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'amateur',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'engines',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'seats',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'weight',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'speed',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
        ],
      },
    },
    {
      __type: Malloy.ModelEntryValueType.Source,
      name: 'aircraft',
      schema: {
        fields: [
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'id',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'tail_num',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'aircraft_serial',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'aircraft_model_code',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'aircraft_engine_code',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'year_built',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'aircraft_type_id',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'aircraft_engine_type_id',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'registrant_type_id',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'name',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'address1',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'address2',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'city',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'state',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'zip',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'region',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'county',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'country',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'certification',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'status_code',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'mode_s_code',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'fract_owner',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'last_action_date',
            type: {
              __type: Malloy.AtomicTypeType.DateType,
              timeframe: undefined,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'cert_issue_date',
            type: {
              __type: Malloy.AtomicTypeType.DateType,
              timeframe: undefined,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'air_worth_date',
            type: {
              __type: Malloy.AtomicTypeType.DateType,
              timeframe: undefined,
            },
          },
          {
            __type: Malloy.FieldInfoType.Measure,
            name: 'aircraft_count',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Join,
            name: 'aircraft_models',
            schema: {
              fields: [
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'aircraft_model_code',
                  type: {
                    __type: Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'manufacturer',
                  type: {
                    __type: Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'model',
                  type: {
                    __type: Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'aircraft_type_id',
                  type: {
                    __type: Malloy.AtomicTypeType.NumberType,
                    subtype: 1,
                  },
                },
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'aircraft_engine_type_id',
                  type: {
                    __type: Malloy.AtomicTypeType.NumberType,
                    subtype: 1,
                  },
                },
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'aircraft_category_id',
                  type: {
                    __type: Malloy.AtomicTypeType.NumberType,
                    subtype: 1,
                  },
                },
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'amateur',
                  type: {
                    __type: Malloy.AtomicTypeType.NumberType,
                    subtype: 1,
                  },
                },
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'engines',
                  type: {
                    __type: Malloy.AtomicTypeType.NumberType,
                    subtype: 1,
                  },
                },
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'seats',
                  type: {
                    __type: Malloy.AtomicTypeType.NumberType,
                    subtype: 1,
                  },
                },
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'weight',
                  type: {
                    __type: Malloy.AtomicTypeType.NumberType,
                    subtype: 1,
                  },
                },
                {
                  __type: Malloy.FieldInfoType.Dimension,
                  name: 'speed',
                  type: {
                    __type: Malloy.AtomicTypeType.NumberType,
                    subtype: 1,
                  },
                },
              ],
            },
            relationship: 1,
          },
        ],
      },
    },
    {
      __type: Malloy.ModelEntryValueType.Source,
      name: 'airports',
      schema: {
        fields: [
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'id',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'code',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'site_number',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'fac_type',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'fac_use',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'faa_region',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'faa_dist',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'city',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'county',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'state',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'full_name',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'own_type',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'longitude',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 2,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'latitude',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 2,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'elevation',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'aero_cht',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'cbd_dist',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'cbd_dir',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'act_date',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'cert',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'fed_agree',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'cust_intl',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'c_ldg_rts',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'joint_use',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'mil_rts',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'cntl_twr',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'major',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
        ],
      },
    },
    {
      __type: Malloy.ModelEntryValueType.Source,
      name: 'state_facts',
      schema: {
        fields: [
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'state',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'aircraft_count',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'airport_count',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'births',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'popular_name',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
        ],
      },
    },
    {
      __type: Malloy.ModelEntryValueType.Source,
      name: 'flights',
      schema: {
        fields: [
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'carrier',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'origin',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'destination',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'flight_num',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'flight_time',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'tail_num',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'dep_time',
            type: {
              __type: Malloy.AtomicTypeType.TimestampType,
              timeframe: undefined,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'arr_time',
            type: {
              __type: Malloy.AtomicTypeType.TimestampType,
              timeframe: undefined,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'dep_delay',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'arr_delay',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'taxi_out',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'taxi_in',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'distance',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'cancelled',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'diverted',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'id2',
            type: {
              __type: Malloy.AtomicTypeType.NumberType,
              subtype: 1,
            },
          },
        ],
      },
    },
    {
      __type: Malloy.ModelEntryValueType.Source,
      name: 'carriers',
      schema: {
        fields: [
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'code',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'name',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
          {
            __type: Malloy.FieldInfoType.Dimension,
            name: 'nickname',
            type: {
              __type: Malloy.AtomicTypeType.StringType,
            },
          },
        ],
      },
    },
  ],
  anonymous_queries: [],
};

const UNCHANGED = Symbol('unchanged');
const MUTATED = Symbol('mutated');
const CLONED = Symbol('cloned');
const ADDED = Symbol('added');
const MOVED = Symbol('moved');
const REMOVED = Symbol('removed');

function compare(
  from,
  to,
  orig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): {changed: boolean; result: any} {
  if (
    typeof orig === 'string' ||
    typeof orig === 'number' ||
    typeof orig === 'boolean' ||
    orig === null
  ) {
    if (orig === to) return {changed: false, result: UNCHANGED};
    return {changed: true, result: to};
  } else if (Array.isArray(from)) {
    if (!Array.isArray(to))
      return {changed: true, result: {'CONVERTED TO ARRAY': to}};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [];
    let changed = orig.length !== to.length;
    for (let i = 0; i < Math.max(orig.length, to.length); i++) {
      const o = orig[i];
      const t = to[i];
      if (o === undefined) {
        changed = true;
        result.push({[ADDED]: t});
      } else if (t === undefined) {
        changed = true;
        result.push({[REMOVED]: i});
      } else if (from[i] === t) {
        result.push(UNCHANGED); // TODO validate it actually is unchanged
      } else {
        changed = true;
        const found = from.findIndex(f => f === t);
        if (found !== -1) {
          result.push({[MOVED]: {from: i, to: found}}); // TODO validate it actually is unchanged
        } else {
          result.push({[ADDED]: t});
        }
      }
    }
    if (from === to) {
      if (changed) {
        return {changed, result: {[MUTATED]: result}};
      }
      return {changed, result: UNCHANGED};
    } else {
      if (changed) {
        return {changed, result};
      }
      return {changed, result: CLONED};
    }
  } else {
    let changed = false;
    const result = {};
    for (const key in from) {
      const {changed: keychanged, result: diff} = compare(
        from[key],
        to[key],
        orig[key]
      );
      result[key] = diff;
      if (keychanged) changed = true;
    }
    for (const key in to) {
      if (key in from) continue;
      changed = true;
      result[key] = to[key];
    }
    if (from === to) {
      if (changed) {
        return {changed, result: {[MUTATED]: result}};
      }
      return {changed, result: UNCHANGED};
    } else {
      if (changed) {
        return {changed, result};
      }
      return {changed, result: CLONED};
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tst(s0: Malloy.Query, manip: (q: ASTQuery) => void, expected: any) {
  const clone = JSON.parse(JSON.stringify(s0));
  const q = new ASTQuery({model: flights_model, query: s0});
  manip(q);
  const s1 = q.build();
  expect(s1).toMatchObject({'foo': 1});
  expect(compare(s0, s1, clone).result).toMatchObject(expected);
}

function ensureOnlyMinimalEdits(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aClone: any,
  path: (string | number)[] = []
): boolean {
  if (
    typeof a === 'string' ||
    typeof a === 'number' ||
    typeof a === 'boolean'
  ) {
    return aClone !== b;
  }
  let different = false;
  if (Array.isArray(a)) {
    different = aClone.length !== b.length;
    for (let i = 0; i < aClone.length || i < b.length; i++) {
      if (a === undefined || b === undefined) {
        different = true;
      } else if (aClone[i] === b[i]) {
        different ||= ensureOnlyMinimalEdits(a[i], b[i], aClone[i], [
          ...path,
          i,
        ]);
      } else {
        different = true;
        const found = aClone.findIndex(f => f === b[i]);
        if (found !== -1) {
          ensureOnlyMinimalEdits(a[found], b[i], aClone[found], [...path, i]);
        }
      }
    }
  } else {
    for (const key in aClone) {
      different ||= ensureOnlyMinimalEdits(a[key], b[key], aClone[key], [
        ...path,
        key,
      ]);
    }
    for (const key in b) {
      if (key in aClone) continue;
      different = true;
    }
  }
  const sameObject = a === b;
  if (different) {
    if (sameObject) {
      throw new Error(`Path /${path.join('/')} was illegally mutated`);
    }
  } else {
    if (!sameObject) {
      throw new Error(`Path /${path.join('/')} was unnecessarily cloned`);
    }
  }
  return different;
}

function tst2(
  s0: Malloy.Query,
  manip: (q: ASTQuery) => void,
  expected: Malloy.Query
) {
  const clone = JSON.parse(JSON.stringify(s0));
  const q = new ASTQuery({model: flights_model, query: s0});
  manip(q);
  const s1 = q.build();
  expect(s1).toMatchObject(expected);
  ensureOnlyMinimalEdits(s0, s1, clone);
}

describe('query builder', () => {
  describe('play', () => {
    test('find', () => {
      const s0 = {pipeline: {stages: []}, source: {name: 'foo'}};
      const q = new ASTQuery({model: flights_model, query: s0});
      const src = q.findReference(['source']);
      expect(src.name).toBe('foo');
    });
    test('foo', () => {
      const s0 = {pipeline: {stages: []}, source: {name: 'foo'}};
      const clone = JSON.parse(JSON.stringify(s0));
      const q = new ASTQuery({model: flights_model, query: s0});
      q.source!.name = 'bar';
      q.source!.addParameter('foo', 'bar');
      const s1 = q.build();
      expect(compare(s0, s1, clone).result).toMatchObject({
        pipeline: UNCHANGED,
        source: {
          name: 'bar',
          parameters: [
            {
              name: 'foo',
              value: {
                __type: 'string_literal',
                string_value: 'bar',
              },
            },
          ],
        },
      });
      // expect(attachRefs(s1, state)).toMatchObject(refs0);
      // expect(s1).toMatchObject(s2);
      // expect(attachRefs(s1, state)).toMatchObject(attachRefs(s2, state));
    });
    test('bar', () => {
      tst(
        {pipeline: {stages: []}, source: {name: 'foo'}},
        q => {
          q.source!.name = 'bar';
          q.source!.addParameter('foo', 'bar');
        },
        {
          pipeline: UNCHANGED,
          source: {
            name: 'bar',
            parameters: [
              {
                name: 'foo',
                value: {
                  __type: 'string_literal',
                  string_value: 'bar',
                },
              },
            ],
          },
        }
      );
    });
    test('add a second parameter', () => {
      tst(
        {
          pipeline: {stages: []},
          source: {
            name: 'foo',
            parameters: [
              {
                name: 'foo',
                value: {
                  __type: Malloy.LiteralValueType.StringLiteral,
                  string_value: 'bar',
                },
              },
            ],
          },
        },
        q => {
          q.source!.addParameter('baz', 0);
        },
        {
          pipeline: UNCHANGED,
          source: {
            name: UNCHANGED,
            parameters: [
              UNCHANGED,
              {
                [ADDED]: {
                  name: 'baz',
                  value: {
                    __type: Malloy.LiteralValueType.NumberLiteral,
                    number_value: 0,
                  },
                },
              },
            ],
          },
        }
      );
    });
    test('add an order by', () => {
      const s0 = {
        pipeline: {stages: []},
        source: {name: 'foo'},
      };
      tst2(
        s0,
        q => {
          q.getOrCreateDefaultSegment().addOrderBy(
            'baz',
            Malloy.OrderByDirection.ASC
          );
        },
        {
          pipeline: {
            stages: [
              {
                refinements: [
                  {
                    __type: Malloy.RefinementType.Segment,
                    operations: [
                      {
                        __type: Malloy.ViewOperationType.OrderBy,
                        items: [
                          {
                            field: {name: 'baz'},
                            direction: Malloy.OrderByDirection.ASC,
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          source: s0.source,
        }
      );
    });
    test('add a group by', () => {
      const s0 = {
        pipeline: {stages: []},
        source: {name: 'flights'},
      };
      tst2(
        s0,
        q => {
          q.getOrCreateDefaultSegment().addGroupBy('carrier');
        },
        {
          pipeline: {
            stages: [
              {
                refinements: [
                  {
                    __type: Malloy.RefinementType.Segment,
                    operations: [
                      {
                        __type: Malloy.ViewOperationType.GroupBy,
                        items: [
                          {
                            field: {
                              expression: {
                                __type: Malloy.ExpressionType.Reference,
                                name: 'carrier',
                              },
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          source: s0.source,
        }
      );
    });
    test('add two group bys', () => {
      const s0 = {
        pipeline: {stages: []},
        source: {name: 'foo'},
      };
      tst2(
        s0,
        q => {
          q.getOrCreateDefaultSegment().addGroupBy('foo').addGroupBy('bar');
        },
        {
          pipeline: {
            stages: [
              {
                refinements: [
                  {
                    __type: Malloy.RefinementType.Segment,
                    operations: [
                      {
                        __type: Malloy.ViewOperationType.GroupBy,
                        items: [
                          {
                            field: {
                              expression: {
                                __type: Malloy.ExpressionType.Reference,
                                name: 'foo',
                              },
                            },
                          },
                          {
                            field: {
                              expression: {
                                __type: Malloy.ExpressionType.Reference,
                                name: 'bar',
                              },
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          source: s0.source,
        }
      );
    });
    test('remove a group by', () => {
      const s0: Malloy.Query = {
        pipeline: {
          stages: [
            {
              refinements: [
                {
                  __type: Malloy.RefinementType.Segment,
                  operations: [
                    {
                      __type: Malloy.ViewOperationType.GroupBy,
                      items: [
                        {
                          field: {
                            expression: {
                              __type: Malloy.ExpressionType.Reference,
                              name: 'foo',
                            },
                          },
                        },
                      ],
                    },
                    {
                      __type: Malloy.ViewOperationType.OrderBy,
                      items: [
                        {
                          field: {name: 'foo'},
                          direction: Malloy.OrderByDirection.ASC,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        source: {name: 'foo'},
      };
      tst2(
        s0,
        q => {
          q.getOrCreateDefaultSegment().removeGroupBy('foo');
        },
        {
          pipeline: {
            stages: [
              {
                refinements: [
                  {
                    __type: Malloy.RefinementType.Segment,
                    operations: [],
                  },
                ],
              },
            ],
          },
          source: s0.source,
        }
      );
    });
    test('compare mutation', () => {
      const a = {x: 1, y: 2};
      const orig = JSON.parse(JSON.stringify(a));
      const b = a;
      b.x = 3;
      expect(compare(a, b, orig).result).toMatchObject({
        [MUTATED]: {x: 3, y: UNCHANGED},
      });
    });
    test('compare unchanged new object', () => {
      const a = {x: 1, y: 2};
      const orig = JSON.parse(JSON.stringify(a));
      const b = JSON.parse(JSON.stringify(a));
      expect(compare(a, b, orig).result).toBe(CLONED);
    });
    test('compare changed new object', () => {
      const a = {x: 1, y: 2};
      const orig = JSON.parse(JSON.stringify(a));
      const b = JSON.parse(JSON.stringify(a));
      b.x = 3;
      expect(compare(a, b, orig).result).toMatchObject({
        'x': 3,
        'y': UNCHANGED,
      });
    });
    test('compare array mutation', () => {
      const a = [1];
      const orig = JSON.parse(JSON.stringify(a));
      const b = a;
      b.push(2);
      expect(compare(a, b, orig).result).toMatchObject({
        [MUTATED]: [UNCHANGED, {[ADDED]: 2}],
      });
    });
    test('compare unchanged new array', () => {
      const a = [1];
      const orig = JSON.parse(JSON.stringify(a));
      const b = [1];
      expect(compare(a, b, orig).result).toBe(CLONED);
    });
    test('compare changed new array', () => {
      const a = [1];
      const orig = JSON.parse(JSON.stringify(a));
      const b = [1, 2];
      expect(compare(a, b, orig).result).toMatchObject([
        UNCHANGED,
        {[ADDED]: 2},
      ]);
    });
    test('compare mutation 2', () => {
      const a = {x: 1, y: 2};
      const orig = JSON.parse(JSON.stringify(a));
      const b = a;
      b.x = 3;
      ensureOnlyMinimalEdits(a, b, orig);
    });
    test('compare changed new array 2', () => {
      const a = [1];
      const orig = JSON.parse(JSON.stringify(a));
      const b = [1, 2];
      ensureOnlyMinimalEdits(a, b, orig);
    });
    test('compare unchanged new array', () => {
      const a = [1];
      const orig = JSON.parse(JSON.stringify(a));
      const b = [1];
      ensureOnlyMinimalEdits(a, b, orig);
    });
    test('compare array mutation 2', () => {
      const a = [1];
      const orig = JSON.parse(JSON.stringify(a));
      const b = a;
      b.push(2);
      ensureOnlyMinimalEdits(a, b, orig);
    });
    test('compare array changed 2', () => {
      const a = [1];
      const orig = JSON.parse(JSON.stringify(a));
      const b = [1, 2];
      ensureOnlyMinimalEdits(a, b, orig);
    });
    test('compare array insert 2', () => {
      const a = [{x: 1}];
      const orig = JSON.parse(JSON.stringify(a));
      const b = [{x: 2}, a[0], {x: 2}];
      ensureOnlyMinimalEdits(a, b, orig);
    });
    // kinda impossible to detect clones when there's also an array modification...
  });
});
