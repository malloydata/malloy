# Joins

Currently, all joins in Malloy are left outer joins, and must be between the primary key of one table to a foreign key in the [shape](/documentation/language/shape.html) being joined to.

### Join Keys

One of the entities being joined must have a primary key. If you specify a bare field name as a _keySpec_ then the primary key for the join will come from the entity being joined. If you specify a field in the join, `joinName.some_id` then the primary key of the shape will be used to complete the join.


### Join Specifications

* _joinName_ `is join on` _keySpec_
* _joinName_ `is join` _existingName_ on _keySpec_
* _joinName_ `is join (` _query_ `)` on _keySpec_

Note that joins through an intermediate table are defined on the definition of that table. When referencing fields not in the source shape, the `.` operator can be used to indicate which table a field comes from; you do not scope to the source shape in Malloy (i.e. when querying the flights table, do not prepend `flights.` to `flight_count`.)

Joins can be defined in a query, or in the model. The below demonstrates the definition of several different joins in a model, and their use in a query.

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

define airports is (explore 'malloy-data.faa.airports'
  primary key code
);

define flights is (explore 'malloy-data.faa.flights'
    aircraft is join on tail_num

  -- need to rename origin and desination fields to avoid namespace collision
  -- between aliased tables and fields; issue is unique to this dataset)
    origin_code renames origin
    destination_code renames destination

  -- join and alias airports table
    origin is join airports on origin_code
    destination is join airports on destination_code
  );

explore flights : [dep_time : @2003-01, origin.code : 'SJC']
| reduce
  destination is destination.code
  flight_count is count()
  aircraft_count is aircraft.count()
  aircraft_model_count is aircraft.aircraft_models.count()
```

For more examples and how to reason about aggregation across joins, review [Foreign Sums](/documentation/patterns/foreign_sums.html)