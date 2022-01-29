# Foreign Sums
Malloy allows you to compute sums, averages correctly based on your join tree.  This example has flights, joining to aircraft, joining to aircraft_model.
`aircraft_model` has the number of seats specified on this model of aircraft.  Code below computes sums and averages at various places in the join tree.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "size":"large"}
// join 3 tables, flights, aircraft and aircraft models.
// `flights` is individual flights
// `aircraft` is the plane that made the flight
// `aircraft_models` is data about the kind of aircraft

explore: aircraft_models is table('malloy-data.faa.aircraft_models') {
  primary_key: aircraft_model_code
}

explore: aircraft is table('malloy-data.faa.aircraft') {
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
}

explore: flights is table('malloy-data.faa.flights') {
  join_one: aircraft with tail_num
}

query: flights -> {
  where: dep_time = @2003-01
  group_by: carrier
  aggregate: [
    // number of flights
    flight_count is count()
    // number of planes
    aircraft_count is aircraft.count()
    // number of different aircraft_models
    aircraft_model_count is aircraft.aircraft_models.count()
    // count each seat once for each flight.
    seats_for_sale is sum(aircraft.aircraft_models.seats)
    // count the seat once for each plane
    seats_on_all_planes is aircraft.sum(aircraft.aircraft_models.seats)
    // average number of seats on each model by model
    average_seats_per_model is aircraft.aircraft_models.seats.avg()
  ]
}
```
