# Bar Charts

There are two types of bar charts.  _Two measure bar charts_ (gradient bar charts) and _Two Dimension Bar_ Charts (stacked bar charts).

## Two Measures

This chart looks at flights and counts the number of aircraft owned by each carrier.  It also, using a gradient,
shows the number of flights made per plane.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "size": "medium", "dataStyles": {"by_carrier":{"renderer":"bar_chart","size":"large"}}}
query: table('malloy-data.faa.flights')->{
  nest: by_carrier is {
    group_by: carrier
    aggregate: aircraft_count is count(distinct tail_num)
    aggregate: flights_per_aircraft is count(*)/count(distinct tail_num)
  }
}
```

Data Style

```json
{
  "by_carrier": {
    "renderer": "bar_chart"
  }
}
```

## Two Dimensions
In this case we are going to look at carriers by flight count and stack the destination.  We are only going to look at flights
with the destination SFO, OAK or SJC.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "size": "medium", "dataStyles": {"by_carrier":{"renderer":"bar_chart","size":"large"}}}
query: table('malloy-data.faa.flights')->{
  where:
    destination : 'SFO'|'OAK'|'SJC'
  top: 10
  nest: by_carrier is {
    group_by: carrier
    aggregate: flight_count is count(*)
    group_by: destination
  }
}
```
Data Style

```json
{
  "by_carrier": {
    "renderer": "bar_chart"
  }
}
```

We could flip the dimensions around and look at the airports' flights by carrier.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "size": "medium", "dataStyles": {"by_carrier":{"renderer":"bar_chart","size":"large"}}}
query: table('malloy-data.faa.flights')->{
  where:
    destination : 'SFO'| 'OAK'|'SJC'
  nest: by_carrier is {
    group_by: destination
    aggregate: flight_count is count(*)
    group_by: carrier
  }
}
```
