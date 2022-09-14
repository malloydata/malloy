# NTSB Flight Database Examples (PostgreSQL)
_This page adapts the NTSB Flight Database examples [here](https://looker-open-source.github.io/malloy/documentation/examples/faa.html) to work with a Postgres instance rather than requiring BigQuery access.  Note that full support for Postgres is in progress and that date/time support is currently incomplete._

## PostgreSQL Setup
Before you can run these NTSB sample models against a Postgres instance, you need to start up / connect to a database server instance and load it with the appropriate data.  These steps setup a database with the NTSB Flight dataset and respective sample models.  These steps use Docker for convenience, but the instructions can be modified to run a Postgres instance directly.

### Start a local Postgres instance
Start a Docker container running Postgres

```bash
docker run --name malloy-postgres -e POSTGRES_PASSWORD=password -d -p 5432:5432 postgres
```

### Load the NTSB dataset into Postgres
From the `malloy/` root directory of the repository, unzip the SQL script that will load the NTSB Flight dataset

```bash
gunzip test/data/postgres/malloytest-postgres.sql.gz
```

Copy the SQL data file into the container

```bash
docker cp test/data/postgres/malloytest-postgres.sql malloy-postgres:/malloytest-postgres.sql
```

Run the file in the container

```bash
docker exec -it malloy-postgres psql -U postgres -f malloytest-postgres.sql
```

## Connect to Postgres in the extension
Use the connection settings shown below to connect the VS Code extension to your local Postgres instance.

 ![postgres-connection-example](https://user-images.githubusercontent.com/25882507/179831294-b6a69ef6-f454-48a7-8b93-aec2bff0ff3f.png)

## Modify the example Malloy models to work with Postgres

The sample models from the NTSB Flight Dataset [here](https://looker-open-source.github.io/malloy/documentation/examples/faa.html#the-malloy-model) reference public BigQuery tables using the standard _project_name.dataset_name.table_name_ BigQuery format.  Therefore, all the data source references with this format need to be changed to the Postgres format.

### Change data source references
All source data references prefixed with `malloy-data.faa.` must be changed to `malloytest.` (since that is the Postgres schema we used above) to conform to Malloy's Postgres _schema_name.table_name_ format (the database name is not required).  Simply find and replace in VS Code or run `sed -i -e 's/malloy-data.faa./malloytest./g' path/to/<your_file.malloy>`

![source_table_reference](https://user-images.githubusercontent.com/25882507/179834102-eef4aee4-973a-4259-bfe4-1487179012b3.png)

## The Updated Malloy Model
The follow example code will run against the local Postgres database.

```malloy
source: airports is table('malloytest.airports') {
  primary_key: code
  dimension: name is concat(code, ' - ', full_name)
  measure: airport_count is count()
}

source: carriers is table('malloytest.carriers') {
  primary_key: code
  measure: carrier_count is count()
}

source: aircraft_models is table('malloytest.aircraft_models') {
  primary_key: aircraft_model_code
  measure: aircraft_model_count is count()
}

source: aircraft is table('malloytest.aircraft') {
  primary_key: tail_num
  measure: aircraft_count is count()
  join_one: aircraft_models with aircraft_model_code
}

source: aircraft_facts is from(
  table('malloytest.flights') -> {
    group_by: tail_num
    aggregate:
      lifetime_flights is count()
      lifetime_distance is distance.sum()
  }
) {
  primary_key: tail_num
  dimension: lifetime_flights_bucketed is floor(lifetime_flights / 1000) * 1000
}

source: flights is table('malloytest.flights') {
  primary_key: id2
  rename: origin_code is origin
  rename: destination_code is destination

  join_one: carriers with carrier
  join_one: origin is airports with origin_code
  join_one: destination is airports with destination_code
  join_one: aircraft with tail_num
  join_one: aircraft_facts with tail_num

  measure:
    flight_count is count()
    total_distance is sum(distance)
    seats_for_sale is sum(aircraft.aircraft_models.seats)
    seats_owned is aircraft.sum(aircraft.aircraft_models.seats)
    // average_seats is aircraft.aircraft_models.avg(aircraft.aircraft_models.seats)
    // average_seats is aircraft.aircraft_models.seats.avg()

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

  // query flights { where: origin.code ? 'SJC' } -> airport_dashboard
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


  // query: southwest_flights is carrier_dashboard { where: carriers.nickname  ? 'Southwest' }
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
  // query flights { where: origin.code = 'SJC', destination.code = 'LAX' | 'BUR', dep_time ? @2004-01-01 } -> kayak
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
}
```
