# NTSB Flight Database examples

_The follow examples all run against the model at the bottom of this page OR you can find the source code [here](https://github.com/looker-open-source/malloy/blob/docs-release/samples/faa/flights.malloy)._

## Airport Dashboard
Where can you fly from SJC? For each destination; Which carriers?  How long have they been flying there?
Are they on time?

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "runMode": "auto",  "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
query: flights -> airport_dashboard { where: origin.code: 'SJC' }
```


## Carrier Dashboard
Tell me everything about a carrier.  How many destinations?, flights? hubs?
What kind of planes to they use? How many flights over time?  What are
the major hubs?  For each destination, How many flights? Where can you? Have they been
flying there long?  Increasing or decreasing year by year?  Any seasonality?

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "runMode": "auto",  "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
query: flights -> carrier_dashboard { where: carriers.nickname : 'Jetblue' }
```


## Kayak Example Query
Suppose you wanted to build a website like Kayak.  Let's assume that the data we have is
in the future instead of the past.  The query below will fetch all the data needed
to render a Kayak page in a singe query.

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "runMode": "auto", "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
query: flights -> kayak {
  where:
    origin.code : 'SJC',
    destination.code : 'LAX'|'BUR',
    dep_time : @2004-01-01
}
```

## Sessionizing Flight Data.
You can think of flight data as event data.  The below is a classic map/reduce roll up of the flight data by carrier and day, plane and day, and individual events for each plane.

```malloy
query: sessionize is {
  group_by: flight_date is dep_time.day
  group_by: carrier
  aggregate: daily_flight_count is flight_count
  nest: per_plane_data is {
    top: 20
    group_by: tail_num
    aggregate: plane_flight_count is flight_count
    nest: flight_legs is {
      order_by: 2
      group_by:
        tail_num
        dep_minute is dep_time.minute
        origin_code
        dest_code is destination_code
        dep_delay
        arr_delay
      ]
    }
  }
}
```


```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "runMode": "auto", "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
query: flights { where: carrier:'WN', dep_time: @2002-03-03 } -> sessionize
```

## The Malloy Model

All of the queries above are executed against the following model:

```malloy
source: airports is table('malloy-data.faa.airports') {
  primary_key: code
  dimension: name is concat(code, ' - ', full_name)
  measure: airport_count is count()
}

source: carriers is table('malloy-data.faa.carriers') {
  primary_key: code
  measure: carrier_count is count()
}

source: aircraft_models is table('malloy-data.faa.aircraft_models') {
  primary_key: aircraft_model_code
  measure: aircraft_model_count is count()
}

source: aircraft is table('malloy-data.faa.aircraft') {
  primary_key: tail_num
  measure: aircraft_count is count()
  join_one: aircraft_models with aircraft_model_code
}

source: aircraft_facts is from(
  table('malloy-data.faa.flights') -> {
    group_by: tail_num
    aggregate:
      lifetime_flights is count()
      lifetime_distance is distance.sum()
  }
) {
  primary_key: tail_num
  dimension: lifetime_flights_bucketed is floor(lifetime_flights / 1000) * 1000
}

source: flights is table('malloy-data.faa.flights') {
  primary_key: id2
  rename: origin_code is origin
  rename: destination_code is destination

  join_one: carriers with carrier
  join_one: origin is airports with origin_code
  join_one: destination is airports with destination_code
  join_one: aircraft with tail_num
  join_one: aircraft_facts with tail_num

  measure: [
    flight_count is count()
    total_distance is sum(distance)
    seats_for_sale is sum(aircraft.aircraft_models.seats)
    seats_owned is aircraft.sum(aircraft.aircraft_models.seats)
    // average_seats is aircraft.aircraft_models.avg(aircraft.aircraft_models.seats)
    // average_seats is aircraft.aircraft_models.seats.avg()
  ]

  query: measures is {
    aggregate:
      flight_count
      aircraft.aircraft_count
      dest_count is destination.airport_count
      origin_count is origin.airport_count
  }

  // shows carriers and number of destinations (bar chart)
  query: by_carrier is {
    group_by: carriers.nickname
    aggregate: flight_count
    aggregate: destination_count is destination.count()
  }

  // shows year over year growth (line chart)
  query: year_over_year is {
    group_by: dep_month is month(dep_time)
    aggregate: flight_count
    group_by: dep_year is dep_time.year
  }

  // shows plane manufacturers and frequency of use
  query: by_manufacturer is {
    top: 5
    group_by: aircraft.aircraft_models.manufacturer
    aggregate: aircraft.aircraft_count, flight_count
  }

  query: delay_by_hour_of_day is {
    where: dep_delay > 30
    group_by: dep_hour is hour(dep_time)
    aggregate: flight_count
    group_by: delay is floor(dep_delay) / 30 * 30
  }

  query: carriers_by_month is {
    group_by: dep_month is dep_time.month
    aggregate: flight_count
    group_by: carriers.nickname
  }

  query: seats_by_distance is {
    // seats rounded to 5
    group_by: seats is floor(aircraft.aircraft_models.seats / 5) * 5
    aggregate: flight_count
    // distance rounded to 20
    group_by: distance is floor(distance / 20) * 20
  }

  query: routes_map is {
    group_by:
      origin.latitude
      origin.longitude
      latitude2 is destination.latitude
      longitude2 is destination.longitude
    aggregate: flight_count
  }

  query: destinations_by_month is {
    group_by: dep_month is dep_time.month
    aggregate: flight_count
    group_by: destination.name
  }

  // query flights { where: origin.code: 'SJC' } -> airport_dashboard
  query: airport_dashboard is {
    top: 10
    group_by: code is destination_code
    group_by: destination is destination.full_name
    aggregate: flight_count
    nest: carriers_by_month, routes_map, delay_by_hour_of_day
  }

  query: plane_usage is {
    order_by: 1 desc
    where: aircraft.aircraft_count > 1
    group_by: aircraft_facts.lifetime_flights_bucketed
    aggregate: aircraft.aircraft_count, flight_count
    nest: by_manufacturer, by_carrier
  }


  // query: southwest_flights is carrier_dashboard { where: carriers.nickname : 'Southwest' }
  query: carrier_dashboard is {
    aggregate: destination_count is destination.airport_count
    aggregate: flight_count
    nest: by_manufacturer
    nest: by_month is {
      group_by: dep_month is dep_time.month
      aggregate: flight_count
    }
    nest: hubs is {
      top: 10
      where: destination.airport_count > 1
      group_by: hub is origin.name
      aggregate: destination_count is destination.airport_count
    }
    nest: origin_dashboard is {
      top: 10
      group_by:
        code is origin_code,
        origin is origin.full_name,
        origin.city
      aggregate: flight_count
      nest: destinations_by_month, routes_map, year_over_year
    }
  }

  query: detail is {
    top: 30 by dep_time
    project:
      id2, dep_time, tail_num, carrier, origin_code, destination_code, distance, aircraft.aircraft_model_code
  }

  // query that you might run for to build a flight search interface
  // query flights { where: origin.code: 'SJC', destination.code: 'LAX' | 'BUR', dep_time: @2004-01-01 } -> kayak
  query: kayak is {
    nest: carriers is {
      group_by: carriers.nickname
      aggregate: flight_count
    }
    nest: by_hour is {
      order_by: 1
      group_by: dep_hour is hour(dep_time)
      aggregate: flight_count
    }
    nest: flights is {
      group_by:
        dep_minute is dep_time.minute
        carriers.name
        flight_num
        origin_code
        destination_code
        aircraft.aircraft_models.manufacturer
        aircraft.aircraft_models.model
    }
  }

  // example query that shows how you can build a map reduce job to sessionize flights
  query: sessionize is {
    group_by: flight_date is dep_time.day
    group_by: carrier
    aggregate: daily_flight_count is flight_count
    nest: per_plane_data is {
      top: 20
      group_by: tail_num
      aggregate: plane_flight_count is flight_count
      nest: flight_legs is {
        order_by: 2
        group_by:
          tail_num
          dep_minute is dep_time.minute
          origin_code
          dest_code is destination_code
          dep_delay
          arr_delay
      }
    }
  }

  -- search_index is (index : [dep_time: @2004-01]
  --   *, carriers.*,
  --   origin.code, origin.state, origin.city, origin.full_name, origin.fac_type
  --   destination.code, destination.state, destination.city, destination.full_name
  --   aircraft.aircraft_model_code, aircraft.aircraft_models.manufacturer
  --   aircraft.aircraft_models.model
  --   on flight_count
  -- )
}
```

## Data Styles
The data styles tell the Malloy renderer how to render different kinds of results.

```json
{
  "by_carrier": {
    "renderer": "bar_chart"
  },
  "year_over_year": {
    "renderer": "line_chart"
  },
  "by_month": {
    "renderer": "line_chart"
  },
  "by_manufacturer": {
    "renderer": "bar_chart"
  },
  "routes_map": {
    "renderer": "segment_map"
  },
  "destinations_by_month": {
    "renderer": "line_chart"
  },
  "delay_by_hour_of_day": {
    "renderer" : "scatter_chart"
  },
  "seats_by_distance": {
    "renderer": "scatter_chart"
  },
  "carriers_by_month" : {
    "renderer": "line_chart"
  }
}
```
