/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import * as Malloy from '@malloydata/malloy-interfaces';

export const flights_model: Malloy.ModelInfo = {
  'entries': [
    {
      '__type': Malloy.ModelEntryValueType.Source,
      'name': 'carriers',
      'schema': {
        'fields': [
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'code',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'name',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'nickname',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Measure,
            'name': 'carrier_count',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
        ],
      },
    },
    {
      '__type': Malloy.ModelEntryValueType.Source,
      'name': 'airports',
      'schema': {
        'fields': [
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'id',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'code',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'site_number',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'fac_type',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'fac_use',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'faa_region',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'faa_dist',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'city',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'county',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'state',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'full_name',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'own_type',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'longitude',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': 2,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'latitude',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': 2,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'elevation',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'aero_cht',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'cbd_dist',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'cbd_dir',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'act_date',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'cert',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'fed_agree',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'cust_intl',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'c_ldg_rts',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'joint_use',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'mil_rts',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'cntl_twr',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'major',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Measure,
            'name': 'airport_count',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'name',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
        ],
      },
    },
    {
      '__type': Malloy.ModelEntryValueType.Source,
      'name': 'aircraft_models',
      'schema': {
        'fields': [
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'aircraft_model_code',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'manufacturer',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'model',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'aircraft_type_id',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'aircraft_engine_type_id',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'aircraft_category_id',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'amateur',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'engines',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'seats',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'weight',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'speed',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Measure,
            'name': 'aircraft_model_count',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
        ],
      },
    },
    {
      '__type': Malloy.ModelEntryValueType.Source,
      'name': 'aircraft',
      'schema': {
        'fields': [
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'id',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'tail_num',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'aircraft_serial',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'aircraft_model_code',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'aircraft_engine_code',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'year_built',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'aircraft_type_id',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'aircraft_engine_type_id',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'registrant_type_id',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'name',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'address1',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'address2',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'city',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'state',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'zip',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'region',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'county',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'country',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'certification',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'status_code',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'mode_s_code',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'fract_owner',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'last_action_date',
            'type': {
              '__type': Malloy.AtomicTypeType.DateType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'cert_issue_date',
            'type': {
              '__type': Malloy.AtomicTypeType.DateType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'air_worth_date',
            'type': {
              '__type': Malloy.AtomicTypeType.DateType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Measure,
            'name': 'aircraft_count',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Join,
            'name': 'aircraft_models',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'aircraft_model_code',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'manufacturer',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'model',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'aircraft_type_id',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'aircraft_engine_type_id',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'aircraft_category_id',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'amateur',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'engines',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'seats',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'weight',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'speed',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Measure,
                  'name': 'aircraft_model_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
              ],
            },
            'relationship': 1,
          },
        ],
      },
    },
    {
      '__type': Malloy.ModelEntryValueType.Source,
      'name': 'flights',
      'schema': {
        'fields': [
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'carrier',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'flight_num',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'flight_time',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'tail_num',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'dep_time',
            'type': {
              '__type': Malloy.AtomicTypeType.TimestampType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'arr_time',
            'type': {
              '__type': Malloy.AtomicTypeType.TimestampType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'dep_delay',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'arr_delay',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'taxi_out',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'taxi_in',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'distance',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'cancelled',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'diverted',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'id2',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'origin_code',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Dimension,
            'name': 'destination_code',
            'type': {
              '__type': Malloy.AtomicTypeType.StringType,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Measure,
            'name': 'flight_count',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Measure,
            'name': 'total_distance',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Measure,
            'name': 'destination_count',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Measure,
            'name': 'origin_count',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Measure,
            'name': 'seats_for_sale',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Measure,
            'name': 'seats_owned',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Measure,
            'name': 'average_plane_size',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Measure,
            'name': 'average_flight_distance',
            'type': {
              '__type': Malloy.AtomicTypeType.NumberType,
              'subtype': Malloy.NumberSubtype.INTEGER,
            },
          },
          {
            '__type': Malloy.FieldInfoType.Join,
            'name': 'carriers',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'code',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'name',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'nickname',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Measure,
                  'name': 'carrier_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
              ],
            },
            'relationship': 1,
          },
          {
            '__type': Malloy.FieldInfoType.Join,
            'name': 'origin',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'id',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'code',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'site_number',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'fac_type',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'fac_use',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'faa_region',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'faa_dist',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'city',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'county',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'state',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'full_name',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'own_type',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'longitude',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': 2,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'latitude',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': 2,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'elevation',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'aero_cht',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'cbd_dist',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'cbd_dir',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'act_date',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'cert',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'fed_agree',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'cust_intl',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'c_ldg_rts',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'joint_use',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'mil_rts',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'cntl_twr',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'major',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Measure,
                  'name': 'airport_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'name',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
              ],
            },
            'relationship': 1,
          },
          {
            '__type': Malloy.FieldInfoType.Join,
            'name': 'destination',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'id',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'code',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'site_number',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'fac_type',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'fac_use',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'faa_region',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'faa_dist',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'city',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'county',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'state',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'full_name',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'own_type',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'longitude',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': 2,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'latitude',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': 2,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'elevation',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'aero_cht',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'cbd_dist',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'cbd_dir',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'act_date',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'cert',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'fed_agree',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'cust_intl',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'c_ldg_rts',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'joint_use',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'mil_rts',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'cntl_twr',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'major',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Measure,
                  'name': 'airport_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'name',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
              ],
            },
            'relationship': 1,
          },
          {
            '__type': Malloy.FieldInfoType.Join,
            'name': 'aircraft',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'id',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'tail_num',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'aircraft_serial',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'aircraft_model_code',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'aircraft_engine_code',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'year_built',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'aircraft_type_id',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'aircraft_engine_type_id',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'registrant_type_id',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'name',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'address1',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'address2',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'city',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'state',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'zip',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'region',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'county',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'country',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'certification',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'status_code',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'mode_s_code',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'fract_owner',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'last_action_date',
                  'type': {
                    '__type': Malloy.AtomicTypeType.DateType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'cert_issue_date',
                  'type': {
                    '__type': Malloy.AtomicTypeType.DateType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'air_worth_date',
                  'type': {
                    '__type': Malloy.AtomicTypeType.DateType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Measure,
                  'name': 'aircraft_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Join,
                  'name': 'aircraft_models',
                  'schema': {
                    'fields': [
                      {
                        '__type': Malloy.FieldInfoType.Dimension,
                        'name': 'aircraft_model_code',
                        'type': {
                          '__type': Malloy.AtomicTypeType.StringType,
                        },
                      },
                      {
                        '__type': Malloy.FieldInfoType.Dimension,
                        'name': 'manufacturer',
                        'type': {
                          '__type': Malloy.AtomicTypeType.StringType,
                        },
                      },
                      {
                        '__type': Malloy.FieldInfoType.Dimension,
                        'name': 'model',
                        'type': {
                          '__type': Malloy.AtomicTypeType.StringType,
                        },
                      },
                      {
                        '__type': Malloy.FieldInfoType.Dimension,
                        'name': 'aircraft_type_id',
                        'type': {
                          '__type': Malloy.AtomicTypeType.NumberType,
                          'subtype': Malloy.NumberSubtype.INTEGER,
                        },
                      },
                      {
                        '__type': Malloy.FieldInfoType.Dimension,
                        'name': 'aircraft_engine_type_id',
                        'type': {
                          '__type': Malloy.AtomicTypeType.NumberType,
                          'subtype': Malloy.NumberSubtype.INTEGER,
                        },
                      },
                      {
                        '__type': Malloy.FieldInfoType.Dimension,
                        'name': 'aircraft_category_id',
                        'type': {
                          '__type': Malloy.AtomicTypeType.NumberType,
                          'subtype': Malloy.NumberSubtype.INTEGER,
                        },
                      },
                      {
                        '__type': Malloy.FieldInfoType.Dimension,
                        'name': 'amateur',
                        'type': {
                          '__type': Malloy.AtomicTypeType.NumberType,
                          'subtype': Malloy.NumberSubtype.INTEGER,
                        },
                      },
                      {
                        '__type': Malloy.FieldInfoType.Dimension,
                        'name': 'engines',
                        'type': {
                          '__type': Malloy.AtomicTypeType.NumberType,
                          'subtype': Malloy.NumberSubtype.INTEGER,
                        },
                      },
                      {
                        '__type': Malloy.FieldInfoType.Dimension,
                        'name': 'seats',
                        'type': {
                          '__type': Malloy.AtomicTypeType.NumberType,
                          'subtype': Malloy.NumberSubtype.INTEGER,
                        },
                      },
                      {
                        '__type': Malloy.FieldInfoType.Dimension,
                        'name': 'weight',
                        'type': {
                          '__type': Malloy.AtomicTypeType.NumberType,
                          'subtype': Malloy.NumberSubtype.INTEGER,
                        },
                      },
                      {
                        '__type': Malloy.FieldInfoType.Dimension,
                        'name': 'speed',
                        'type': {
                          '__type': Malloy.AtomicTypeType.NumberType,
                          'subtype': Malloy.NumberSubtype.INTEGER,
                        },
                      },
                      {
                        '__type': Malloy.FieldInfoType.Measure,
                        'name': 'aircraft_model_count',
                        'type': {
                          '__type': Malloy.AtomicTypeType.NumberType,
                          'subtype': Malloy.NumberSubtype.INTEGER,
                        },
                      },
                    ],
                  },
                  'relationship': 1,
                },
              ],
            },
            'relationship': 1,
          },
          {
            '__type': Malloy.FieldInfoType.View,
            'name': 'top_carriers',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'nickname',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'flight_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'destination_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'percentage_of_flights',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                  },
                },
              ],
            },
          },
          {
            '__type': Malloy.FieldInfoType.View,
            'name': 'carriers_over_time',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'dep_month',
                  'type': {
                    '__type': Malloy.AtomicTypeType.TimestampType,
                    'timeframe': 3,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'flight_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'nickname',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
              ],
            },
          },
          {
            '__type': Malloy.FieldInfoType.View,
            'name': 'top_origins',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'name',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'flight_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'destination_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'carrier_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'percent_of_flights',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                  },
                },
              ],
            },
          },
          {
            '__type': Malloy.FieldInfoType.View,
            'name': 'top_destinations',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'code',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'full_name',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'flight_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'percent_of_flights_to_destination',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                  },
                },
              ],
            },
          },
          {
            '__type': Malloy.FieldInfoType.View,
            'name': 'by_month',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'dep_month',
                  'type': {
                    '__type': Malloy.AtomicTypeType.TimestampType,
                    'timeframe': 3,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'flight_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
              ],
            },
          },
          {
            '__type': Malloy.FieldInfoType.View,
            'name': 'by_manufacturer',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'manufacturer',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'flight_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'aircraft_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
              ],
            },
          },
          {
            '__type': Malloy.FieldInfoType.View,
            'name': 'top_routes_map',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'latitude',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': 2,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'longitude',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': 2,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'latitude2',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': 2,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'longitude2',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': 2,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'flight_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
              ],
            },
          },
          {
            '__type': Malloy.FieldInfoType.View,
            'name': 'carrier_dashboard',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'destination_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'flight_count',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'by_manufacturer',
                  'type': {
                    '__type': Malloy.AtomicTypeType.ArrayType,
                    'element_type': {
                      '__type': Malloy.AtomicTypeType.RecordType,
                      'fields': [
                        {
                          'name': 'manufacturer',
                          'type': {
                            '__type': Malloy.AtomicTypeType.StringType,
                          },
                        },
                        {
                          'name': 'flight_count',
                          'type': {
                            '__type': Malloy.AtomicTypeType.NumberType,
                            'subtype': Malloy.NumberSubtype.INTEGER,
                          },
                        },
                        {
                          'name': 'aircraft_count',
                          'type': {
                            '__type': Malloy.AtomicTypeType.NumberType,
                            'subtype': Malloy.NumberSubtype.INTEGER,
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'by_month',
                  'type': {
                    '__type': Malloy.AtomicTypeType.ArrayType,
                    'element_type': {
                      '__type': Malloy.AtomicTypeType.RecordType,
                      'fields': [
                        {
                          'name': 'dep_month',
                          'type': {
                            '__type': Malloy.AtomicTypeType.TimestampType,
                            'timeframe': Malloy.TimestampTimeframe.MONTH,
                          },
                        },
                        {
                          'name': 'flight_count',
                          'type': {
                            '__type': Malloy.AtomicTypeType.NumberType,
                            'subtype': Malloy.NumberSubtype.INTEGER,
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'hubs',
                  'type': {
                    '__type': Malloy.AtomicTypeType.ArrayType,
                    'element_type': {
                      '__type': Malloy.AtomicTypeType.RecordType,
                      'fields': [
                        {
                          'name': 'hub',
                          'type': {
                            '__type': Malloy.AtomicTypeType.StringType,
                          },
                        },
                        {
                          'name': 'destination_count',
                          'type': {
                            '__type': Malloy.AtomicTypeType.NumberType,
                            'subtype': Malloy.NumberSubtype.INTEGER,
                          },
                        },
                        {
                          'name': 'flight_count',
                          'type': {
                            '__type': Malloy.AtomicTypeType.NumberType,
                            'subtype': Malloy.NumberSubtype.INTEGER,
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'origin_dashboard',
                  'type': {
                    '__type': Malloy.AtomicTypeType.ArrayType,
                    'element_type': {
                      '__type': Malloy.AtomicTypeType.RecordType,
                      'fields': [
                        {
                          'name': 'code',
                          'type': {
                            '__type': Malloy.AtomicTypeType.StringType,
                          },
                        },
                        {
                          'name': 'origin',
                          'type': {
                            '__type': Malloy.AtomicTypeType.StringType,
                          },
                        },
                        {
                          'name': 'city',
                          'type': {
                            '__type': Malloy.AtomicTypeType.StringType,
                          },
                        },
                        {
                          'name': 'flight_count',
                          'type': {
                            '__type': Malloy.AtomicTypeType.NumberType,
                            'subtype': Malloy.NumberSubtype.INTEGER,
                          },
                        },
                        {
                          'name': 'destinations_by_month_line_chart',
                          'type': {
                            '__type': Malloy.AtomicTypeType.ArrayType,
                            'element_type': {
                              '__type': Malloy.AtomicTypeType.RecordType,
                              'fields': [
                                {
                                  'name': 'dep_month',
                                  'type': {
                                    '__type':
                                      Malloy.AtomicTypeType.TimestampType,
                                    'timeframe': 3,
                                  },
                                },
                                {
                                  'name': 'flight_count',
                                  'type': {
                                    '__type': Malloy.AtomicTypeType.NumberType,
                                    'subtype': Malloy.NumberSubtype.INTEGER,
                                  },
                                },
                                {
                                  'name': 'name',
                                  'type': {
                                    '__type': Malloy.AtomicTypeType.StringType,
                                  },
                                },
                              ],
                            },
                          },
                        },
                        {
                          'name': 'top_routes_map',
                          'type': {
                            '__type': Malloy.AtomicTypeType.ArrayType,
                            'element_type': {
                              '__type': Malloy.AtomicTypeType.RecordType,
                              'fields': [
                                {
                                  'name': 'latitude',
                                  'type': {
                                    '__type': Malloy.AtomicTypeType.NumberType,
                                    'subtype': 2,
                                  },
                                },
                                {
                                  'name': 'longitude',
                                  'type': {
                                    '__type': Malloy.AtomicTypeType.NumberType,
                                    'subtype': 2,
                                  },
                                },
                                {
                                  'name': 'latitude2',
                                  'type': {
                                    '__type': Malloy.AtomicTypeType.NumberType,
                                    'subtype': 2,
                                  },
                                },
                                {
                                  'name': 'longitude2',
                                  'type': {
                                    '__type': Malloy.AtomicTypeType.NumberType,
                                    'subtype': 2,
                                  },
                                },
                              ],
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
          {
            '__type': Malloy.FieldInfoType.View,
            'name': 'search_index',
            'schema': {
              'fields': [
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'fieldName',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'fieldPath',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'fieldValue',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'fieldType',
                  'type': {
                    '__type': Malloy.AtomicTypeType.StringType,
                  },
                },
                {
                  '__type': Malloy.FieldInfoType.Dimension,
                  'name': 'weight',
                  'type': {
                    '__type': Malloy.AtomicTypeType.NumberType,
                    'subtype': Malloy.NumberSubtype.INTEGER,
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
  'anonymous_queries': [],
};
