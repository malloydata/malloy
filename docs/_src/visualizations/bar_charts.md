# Bar Charts

There are two types of bar charts.  _Two measure bar charts_ (gradiant bar charts) and _Two Dimension Bar_ Charts (stacked bar charts).

## Two Measure Bar Charts.

This chart looks at flights and counts the number of aircraft owned by each carrier.  It also, using a gradiant,
shows the number of flights made per plane.

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "size": "medium", "dataStyles": {"by_carrier":{"renderer":"bar_chart"}}}
explore 'malloy-data.faa.flights' | reduce
  by_carrier is (reduce
    carrier
    aircraft_count is count(distinct tail_num)
    flights_per_aircraft is count(*)/count(distinct tail_num)
  )
```

Data Style

```json
{
  "by_carrier": {
    "renderer": "bar_chart"
  }
}
```

## Two Dimension Barcharts
In this case we are going to look at carriers by flight count and stack the destination.  We are only going to look at flights 
with the destination SFO, OAK or SJC.  

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "size": "medium", "dataStyles": {"by_carrier":{"renderer":"bar_chart"}}}
explore 'malloy-data.faa.flights' 
| reduce : [
    destination : 'SFO'|'OAK'|'SJC'
  ] top 10
  by_carrier is (reduce
    carrier
    flight_count is count(*)
    destination
  )
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
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "size": "medium", "dataStyles": {"by_carrier":{"renderer":"bar_chart"}}}
explore 'malloy-data.faa.flights' 
| reduce : [destination : 'SFO'|'OAK'|'SJC']
by_carrier is (reduce
  destination
  flight_count is count(*)
  carrier, 
)
```

