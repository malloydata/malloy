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

import {medicareModel} from './medicare_model';

const faaModel = `
  source: aircraft_models is bigquery.table('malloytest.aircraft_models') extend {
    primary_key: aircraft_model_code

    measure:
      total_seats is seats.sum()
  }

  source: airports is bigquery.table('malloytest.airports') extend {
    primary_key: code
    measure: \`count\` is count()
  }

  source: carriers is bigquery.table('malloytest.carriers') extend {
    primary_key: code
  }

  source: aircraft is bigquery.table('malloytest.aircraft') extend {
    primary_key: tail_num

    join_one: aircraft_models on aircraft_model_code = aircraft_models.aircraft_model_code

    measure:
      aircraft_count is count()
      total_engines is aircraft_models.engines.sum()
  }

  source: flights is bigquery.table('malloytest.flights') extend {
    primary_key: id2

    rename:
      origin_code is origin
      destination_code is destination

    measure:
      flight_count is count()
      total_distance is distance.sum()

    join_one: carriers on carrier = carriers.code

    join_one: aircraft on tail_num = aircraft.tail_num

    join_one: origin is airports on origin_code = origin.code

    join_one: destination is airports on destination_code = destination.code

    join_one: aircraft_facts is  bigquery.table('malloytest.flights') -> {
      group_by: tail_num
      aggregate: lifetime_distance is distance.sum()
    } extend {
      primary_key: tail_num
    } on tail_num = aircraft_facts.tail_num

    view: flights_by_carrier is {
      group_by: carriers.name
      aggregate: flight_count
      aggregate: origin_count is origin.count()
      aggregate: my_total_distance is distance.sum()
      order_by: name asc
    }

    view: flights_by_carrier_2001_2002 is {
      group_by: carriers.name
      aggregate: flights_2001 is count() {
        where: dep_time.year = @2001
      }
      aggregate: flights_2002 is count() {
        where: dep_time.year = @2002
      }
      order_by: name asc
    }

    view: flights_by_city_top_5 is {
      group_by: destination.city
      aggregate: flight_count
      limit: 5
    }

    view: flights_by_model is {
      group_by:
        aircraft.aircraft_models.manufacturer
        aircraft.aircraft_models.model
      aggregate:
        aircraft.aircraft_count
        flight_count
      limit: 5
    }

    view: aircraft_facts_query is {
      group_by: tail_num
      aggregate: lifetime_distance is distance.sum()
    }

    view: carriers_by_total_engines is {
      group_by: carriers.name
      aggregate:
        aircraft.total_engines
        flight_count
    }

    view: aircraft_facts_test is {
      group_by: aircraft_facts.lifetime_distance
      aggregate: flight_count
    }

    view: measures_first is {
      aggregate:
        flight_count
      group_by:
        origin.city
        origin.state
    }

    view: top_5_routes is {
      group_by:
        origin_code
        destination_code
      aggregate: flight_count
      order_by: flight_count desc
      limit: 5
    }

    view: first_turtle is {
      group_by: carrier
      aggregate: flight_count
      nest: top_5_routes
    }

    view: carriers_routes is {
      group_by: carrier
      aggregate: flight_count
      nest: top_5_routes
    }

    view: new_york_airports is {
      group_by: destination.code
      aggregate: flight_count
      where: destination.state = 'NY'
      order_by: flight_count desc
    }

    view: flights_by_manufacturer is {
      group_by: aircraft.aircraft_models.manufacturer
      aggregate:
        aircraft.aircraft_count
        flight_count
      limit: 5
    }

    view: carriers_routes_manufacturer is {
      group_by: carrier
      aggregate: flight_count
      nest: top_5_routes
      nest: flights_by_manufacturer
    }

    view: top_5_routes_carriers is {
      group_by:
        origin_code
        destination_code
      aggregate: flight_count
      nest: flights_by_carrier
      limit: 5
      order_by: flight_count desc
    }

    view: flights_by_carrier_with_totals is {
      where: origin.state = 'CA'
      nest: main is {
        group_by: carriers.name
        aggregate: flight_count
        aggregate: origin_count is origin.count()
        order_by: flight_count desc
      }
    }

    view: totals is {
      aggregate: flight_count
    }

    view: flight_detail is {
      group_by:
        id2
        dep_time
        tail_num
        carrier
        origin_code
        destination_code
        distance
        dep_delay
      order_by: dep_time asc
      limit: 500
    }

    view: some_measures is {
      aggregate:
        flight_count
        total_distance
        aircraft.aircraft_count
    }

    view: flights_routes_sessionized is {
      where: origin.state = 'CA'
      where: carrier = 'UA'
      limit: 20
      group_by: dep_date is dep_time.day
      group_by: carrier
      nest: routes is {
        group_by:
          origin_code
          destination_code
        aggregate:
          flight_count
        nest: flight_detail is {
          group_by:
            id2
            dep_time
            tail_num
            distance
            dep_delay
          order_by: dep_time asc
          limit: 5
        }
        order_by: flight_count desc
      }
    }

    view: flights_aircraft_sessionized is {
      group_by: dep_date is dep_time.day
      group_by: carrier
      aggregate: flight_count
      nest: aircraft is {
        group_by: tail_num
        aggregate: flight_count
        nest: flight_detail is {
          group_by:
            id2
            dep_time
            origin_code
            destination_code
            flight_num
            dep_delay
          order_by: 2
        }
        order_by: flight_count desc
      }
    }

    view: search_index is {
      index:
        carrier
        origin_code
        destination_code
        carriers.name
        carriers.nickname
        carriers.code
        origin.code
        origin.full_name
        origin.city
        origin.state
        destination.code
        destination.full_name
        destination.city
        destination.state
        aircraft.aircraft_model_code
        aircraft.aircraft_models.manufacturer
        aircraft.aircraft_models.model
    }
  }

  source: table_airports is airports
`;

export const testModel = faaModel + medicareModel;
