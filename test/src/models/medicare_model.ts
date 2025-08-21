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

export const medicareModel = `
  source: medicare_test is bigquery.table('malloytest.bq_medicare_test') extend {
    primary_key: id

    rename:
      discharges is total_discharges

    measure:
      count_of_drugs is count()
      provider_count is count(provider_id)
      total_discharges is discharges.sum()

    view: discharges_by_state is {
      group_by: provider_state
      aggregate: total_discharges
      order_by: 2 desc
    }

    view: discharges_by_city is {
      group_by: provider_city
      aggregate: total_discharges
      order_by: 2 desc
    }

    view: discharges_by_zip is {
      group_by: provider_zipcode
      aggregate: total_discharges
      order_by: 2 desc
    }

    view: bigturtle_state is {
      group_by: provider_state
      aggregate: total_discharges
      nest:
        discharges_by_city
        discharges_by_zip
    }

    view: turtle_city_zip is {
      group_by: provider_city
      aggregate: total_discharges
      nest: discharges_by_zip
      order_by: 1 desc
    }

    view: triple_turtle is {
      group_by: provider_state
      aggregate: total_discharges
      nest: turtle_city_zip
      order_by: 1 desc
    }

    view: rollup_by_location is {
      group_by: provider_state
      aggregate: total_discharges
      nest: turtle_city_zip is {
        group_by: provider_city
        aggregate: total_discharges
        nest: discharges_by_zip is {
          group_by: provider_zipcode
          aggregate: total_discharges
          order_by: 2 desc
        }
        order_by: 1 desc
      }
      order_by: 1 desc
    }
  }

  source: medicare_state_facts is medicare_test -> {
    group_by: provider_state
    aggregate: num_providers is count(provider_id)
  }
`;
