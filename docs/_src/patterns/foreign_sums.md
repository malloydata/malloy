# Foreign Sums
Malloy allows you to compute sums, averages correctly based on your join tree.  This example has flights, joining to aircraft, joining to aircraft_model.
`aircraft_model` has the number of seats specified on this model of aircraft.  Code below computes sums and averages at various places in the join tree.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "size":"large"}
-- join 3 tables, flights, aircraft and aircraft models.
-- 'flights' is individual flights
-- 'aircraft' is the plane that made the flight
-- 'aircraft_models' is data about the kind of aircraft

define aircraft_models is (explore 'malloy-data.faa.aircraft_models'
  primary key aircraft_model_code
);

define aircraft is (explore 'malloy-data.faa.aircraft'
  primary key tail_num
  aircraft_models is join on aircraft_model_code
);

define flights is (explore 'malloy-data.faa.flights'
  aircraft is join on tail_num
);

explore flights : [dep_time : @2003-01]
| reduce
  carrier
  -- number of flights
  flight_count is count(*)
  -- number of planes
  aircraft_count is aircraft.count()
  -- number of different aircraft_models
  aircraft_model_count is aircraft.aircraft_models.count()
  -- count each seat once for each flight.
  seats_for_sale is sum(aircraft.aircraft_models.seats)
  -- count the seat once for each plane
  seats_on_all_planes is aircraft.sum(aircraft.aircraft_models.seats)
  -- average number of seats on each model by model
  average_seats_per_model is aircraft.aircraft_models.seats.avg()
```