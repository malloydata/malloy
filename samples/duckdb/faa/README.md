# About the FAA Dataset

The NTSB FAA Dataset includes information about flights, airports, carriers, and aircrafts. We are providing here a small subset of the full dataset (available in BigQuery) for the purpose of trying out Malloy; please note that the data is INCOMPLETE and to properly analyze this data the full dataset available in BigQuery should be used.

## Overview of models

This set of models is a great place to get introduced to Malloy for the first time. You can use this model to follow along with the [Malloy by Example document](https://looker-open-source.github.io/malloy/documentation/#malloy-by-example).

**`1_airports`** - the simplest model, using only the airports table. Start here to get familiar with core concepts in Malloy.

**`2_flights`** - defines as a source each table, and defines join relationships between them;  adds a few useful fields

**`3_carrier_analysis`** - builds on the flights source to analyze top carriers and their top destinations. Demonstrates simple percent of total calculations.

**`4_routes`** - shows top routes for each carrier. Demonstrates route mapping

**`5_time_based`** - time series analysis of flight data. Demonstrates ease of transforming and filtering with time.

**`6_aircraft_analysis`** - looks at the aircraft used by carriers. Demonstrates simplification of working with aggregates in Malloy. 

**`7_sessionization`** - defines daily sessions for airplanes by tail number, then shows flight stats for each leg. 

**`8_dashboard`** - puts together top level metrics and a number of nested queries to provide a dense view of flight data. The dashboard works well filtered to specific carriers (examples at the bottom).




