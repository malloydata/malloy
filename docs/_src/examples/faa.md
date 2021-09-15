# NTSB Flight Database examples

The follow examples all run against the model at the bottom of this page.

## Airport Dashboard
Where can you fly from SJC? For each destination; Which carriers?  How long have they been flying there?
Are they ontime?

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "runMode": "auto",  "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
explore flights : [origin.code : 'SJC']
| airport_dashboard
```


## Carrier Dashboard
Tell me everything about a carrier.  How many destinations?, flights? hubs?
What kind of planes to they use? How many flights over time?  What are
the major hubs?  For each destionation, How many flights? Where can you? Have they been
flying there long?  Increasing or decresing year by year?  Any seasonality?

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "runMode": "auto",  "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
explore flights : [carriers.nickname : 'Jetblue']
| carrier_dashboard
```


## Kayak Example Query
Suppose you wanted to build a website like Kayak.  Let's assume that the data we have is
in the future instead ofthe past.  The query below will fetch all the data needed
to render a Kayak page in a singe query.

```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "runMode": "auto", "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
explore flights : [
  origin.code : 'SJC',
  destination.code : 'LAX'|'BUR',
  dep_time : @2004-01-01
]
| kayak
```

## Sessionizing Flight Data.
You can think of flight data as event data.  The below is a classic map/reduce roll up of the filght data by carrier and day, plane and day, and individual events for each plane.

```malloy
  sessionize is (reduce : [carrier:'WN', dep_time: @2002-03-03]
    dep_time.`date`
    carrier
    flight_count
    plane is (reduce top 20
      tail_num
      flight_count
      flights is (reduce order by 2
        tail_num
        dep_minute is dep_time.minute
        origin_code
        destination_code
      )
    )
  )
```


```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "runMode": "auto", "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
explore flights
| sessionize
```

## The Malloy Model

All of the queries above are executed against the following model:

```malloy
define airports is (explore 'malloy-data.faa.airports'
  primary key code
  name is concat(code, ' - ', full_name)
  airport_count is count()
);

define carriers is (explore 'malloy-data.faa.carriers'
  primary key code
  carrier_count is count()
);

define aircraft_models is (explore 'malloy-data.faa.aircraft_models'
  primary key aircraft_model_code
  aircraft_model_count is count()
);

define aircraft is (explore 'malloy-data.faa.aircraft'
  primary key tail_num
  aircraft_count is count()
  -- joins
  aircraft_models is join on aircraft_model_code
);

export define flights is (explore 'malloy-data.faa.flights'
  primary key id2
  -- rename some fields
  origin_code renames origin
  destination_code renames destination

  -- joins
  carriers is join on carrier
  origin is join airports on origin_code
  destination is join airports on destination_code,
  aircraft is join on tail_num

  -- measures
  flight_count is count()
  total_distance is sum(distance)
  seats_for_sale is sum(aircraft.aircraft_models.seats)
  seats_owned is aircraft.sum(aircraft.aircraft_models.seats)

  -- queries
  measures is (reduce
    flight_count
    aircraft.aircraft_count
    dest_count is destination.airport_count
    origin_count is origin.airport_count
  )

  -- shows carriers and number of destinations (bar chart)
  by_carrier is (reduce
    carriers.nickname
    flight_count
    destination_count is destination.count()
  )

  -- shows year over year growth (line chart)
  year_over_year is (reduce
    dep_month is month(dep_time)
    flight_count
    dep_year is dep_time.year
  )

  -- shows plane manufacturers and frequency of use
  by_manufacturer is (reduce top 20
    aircraft.aircraft_models.manufacturer
    aircraft.aircraft_count
    flight_count
  )

  delay_by_hour_of_day is (reduce : [dep_delay >30]
    dep_hour is hour(dep_time)
    flight_count
    delay is FLOOR(dep_delay)/30 * 30
  )

  carriers_by_month is (reduce
    dep_month is dep_time.month
    flight_count
    carriers.nickname
  )

  seats_by_distance is (reduce
    seats is floor(aircraft.aircraft_models.seats/5)*5 -- rounded to 5
    flight_count
    distance is floor(distance/20)*20 -- rounded to 20
  )

  routes_map is (reduce
    origin.latitude
    origin.longitude
    latitude2 is destination.latitude
    longitude2 is destination.longitude
    flight_count
  )

  destinations_by_month is (reduce
    dep_time.`month`
    flight_count
    destination.name
  )

  -- explore flights : [origin.code : 'SJC'] | airport_dashboard
  airport_dashboard is ( reduce top 10
    code is destination_code
    destination is destination.full_name
    flight_count
    carriers_by_month
    routes_map
    delay_by_hour_of_day
  )

  -- explore flights : [carriers.nickname : 'Southwest'] | carrier_dashboard
  carrier_dashboard is ( reduce
    destination_count is destination.airport_count
    flight_count
    by_manufacturer
    by_month is (reduce
      dep_month is dep_time.month
      flight_count
    )
    hubs is (reduce : [destination.airport_count > 1] top 10
      hub is origin.name
      destination_count is destination.airport_count
    )
    origin_dashboard is (reduce top 10
      code is origin_code
      origin is origin.full_name
      origin.city
      flight_count
      destinations_by_month
      routes_map
      year_over_year
    )
  )

  detail is (project top 30 order by 2
    id2, dep_time, tail_num, carrier, origin_code, destination_code, distance
    aircraft.aircraft_model_code
  )

  -- query that you might run for to build a flight search interface
  -- explore flights : [origin.code: 'SJC', destination.code:'LAX'|'BUR', dep_time: @2004-01-01] | kayak
  kayak is (reduce
    carriers is (reduce
      carriers.nickname
      flight_count
    )
    by_hour is (reduce order by 1
      dep_hour is hour(dep_time)
      flight_count
    )
    flights is (reduce
      dep_minute is dep_time.minute
      carriers.name
      flight_num
      origin_code
      destination_code
      aircraft.aircraft_models.manufacturer
      aircraft.aircraft_models.model
    )
  )

  -- example query that shows how you can build a map reduce job to sessionize flights
  sessionize is (reduce : [carrier:'WN', dep_time: @2002-03-03]
    dep_time.`date`
    carrier
    flight_count
    plane is (reduce top 20
      tail_num
      flight_count
      flights is (reduce order by 2
        tail_num
        dep_minute is dep_time.minute
        origin_code
        destination_code
        )
    )
  )

  search_index is (index : [dep_time: @2004-01]
    *, carriers.*,
    origin.code, origin.state, origin.city, origin.full_name, origin.fac_type
    destination.code, destination.state, destination.city, destination.full_name
    aircraft.aircraft_model_code, aircraft.aircraft_models.manufacturer
    aircraft.aircraft_models.model
    on flight_count
  )
);
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