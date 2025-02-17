/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';

export const flights_model: Malloy.ModelInfo = {
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
