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


## Preview Tables

**Airports**

|     id | code | site_number | fac_type | fac_use | faa_region | faa_dist | city                    | county           | state | full_name       | own_type | longitude | latitude | elevation | aero_cht      | cbd_dist | cbd_dir | act_date | cert | fed_agree | cust_intl | c_ldg_rts | joint_use | mil_rts | cntl_twr | major |   |
|-------:|------|-------------|----------|---------|------------|----------|-------------------------|------------------|-------|-----------------|----------|----------:|---------:|----------:|---------------|---------:|---------|----------|------|-----------|-----------|-----------|-----------|---------|----------|-------|:-:|
| 19,783 | 1Q9  | 51518.6*A   | AIRPORT  | PU      | null       | HNL      | MILI ISLAND             | MARSHALL ISLANDS | null  | MILI            | PU       |    171.73 |     6.08 |         4 | CAPE LISBURNE |        0 | N       | 06/1983  | null | null      | null      | null      | null      | null    | N        | N     |   |
| 19,777 | Q51  | 51515.5*A   | AIRPORT  | PU      | null       | HNL      | KILI ISLAND             | MARSHALL ISLANDS | null  | KILI            | PU       |    169.11 |     5.65 |         5 | CAPE LISBURNE |        0 | N       | 06/1983  | null | null      | null      | null      | null      | null    | N        | N     |   |
| 19,787 | 3N1  | 51534.5*A   | AIRPORT  | PU      | null       | HNL      | TAORA IS MALOELAP ATOLL | MARSHALL ISLANDS | null  | MALOELAP        | PU       |    171.23 |      8.7 |         4 | CAPE LISBURNE |        0 | E       | 06/1983  | null | null      | null      | null      | null      | null    | N        | N     |   |
| 19,789 | 03N  | 51538.*A    | AIRPORT  | PU      | null       | HNL      | UTIRIK ISLAND           | MARSHALL ISLANDS | null  | UTIRIK          | PU       |    169.85 |    11.23 |         4 | CAPE LISBURNE |        0 | SE      | 06/1983  | null | null      | null      | null      | null      | null    | N        | N     |   |
| 19,774 | ANG  | 51512.01*A  | AIRPORT  | PU      | null       | HNL      | ANGAUR ISLAND           | PALAU            | null  | ANGAUR AIRSTRIP | PU       |    134.15 |      6.9 |        20 | GNC 13        |       30 | SW      | 04/1983  | null | null      | null      | null      | null      | null    | N        | N     |   |

**Flights**
| carrier | flight_num | flight_time | tail_num | dep_time            | arr_time            | dep_delay | arr_delay | taxi_out | taxi_in | distance | cancelled | diverted |        id2 | origin_code | destination_code |   |
|---------|------------|------------:|----------|---------------------|---------------------|----------:|----------:|---------:|--------:|---------:|-----------|----------|-----------:|-------------|------------------|:-:|
| US      | 1692       |          15 | N806MD   | 2004-11-18 22:32:00 | 2004-11-18 23:09:00 |        -3 |        -6 |       18 |       4 |       55 | N         | N        | 30,272,525 | PHL         | ABE              |   |
| US      | 1650       |          18 | N806MD   | 2004-10-12 20:46:00 | 2004-10-12 21:28:00 |         6 |         0 |       20 |       4 |       55 | N         | N        | 29,742,442 | PHL         | ABE              |   |
| US      | 1616       |          19 | N816MA   | 2004-11-24 10:20:00 | 2004-11-24 11:14:00 |         0 |         2 |       30 |       5 |       55 | N         | N        | 30,270,885 | PHL         | ABE              |   |
| US      | 1650       |          17 | N806MD   | 2004-08-31 20:30:00 | 2004-08-31 21:06:00 |         0 |       -19 |       15 |       4 |       55 | N         | N        | 28,344,746 | PHL         | ABE              |   |
| US      | 1643       |          17 | N806MD   | 2004-07-27 10:21:00 | 2004-07-27 10:59:00 |        -4 |       -19 |       17 |       4 |       55 | N         | N        | 27,898,410 | PHL         | ABE              |   |

**Carriers**

| code | name                        | nickname           |
|------|-----------------------------|--------------------|
| EV   | Atlantic Southeast Airlines | Atlantic Southeast |
| NW   | Northwest Airlines          | Northwest          |
| AA   | American Airlines           | American           |
| FL   | Airtran Airways Corporation | Airtran            |
| B6   | Jetblue Airways             | Jetblue            |

**Aircraft**

|  id | tail_num | aircraft_serial | aircraft_model_code | aircraft_engine_code | year_built | aircraft_type_id | aircraft_engine_type_id | registrant_type_id | name                          | address1                | address2 | city         | state | zip        | region | county | country | certification | status_code | mode_s_code | fract_owner | last_action_date | cert_issue_date | air_worth_date |   |
|----:|----------|-----------------|---------------------|----------------------|-----------:|-----------------:|------------------------:|-------------------:|-------------------------------|-------------------------|----------|--------------|-------|------------|--------|--------|---------|---------------|-------------|-------------|-------------|------------------|-----------------|----------------|:-:|
| 100 | N10036   | 11906           | 7100510             | 17003                |      1,944 |                4 |                       1 |                  1 | FORSBERG CHARLES P            | PO BOX 1                | null     | NORTH SUTTON | NH    | 03260-0001 | E      | 013    | US      | 1N            | A           | 50003624    | null        | 2006-01-17       | 1982-04-27      | 1972-09-11     |   |
| 200 | N1006L   | 1234            | 05620R2             | null                 |      2,000 |                4 |                       1 |                  1 | BOEGER BOGIE M                | 7246 235TH ST           | null     | MEDIAPOLIS   | IA    | 52637-9184 | 3      | 057    | US      | null          | V           | 50003751    | null        | 2005-10-27       | 2005-10-27      | ∅              |   |
| 300 | N1009P   | 34994           | 2072704             | 17026                |      1,958 |                4 |                       1 |                  4 | FERRIER WILLIAM T             | 221 N CENTRAL AVE # D86 | null     | MEDFORD      | OR    | 97501-5927 | S      | 029    | US      | 1             | V           | 50004125    | null        | 2003-09-19       | 2003-09-19      | 1958-02-21     |   |
| 400 | N100EJ   | 380-1           | 6402618             | 30010                |      1,973 |                5 |                       4 |                  3 | CENTURION INVESTMENTS INC DBA | 18377 EDISON AVE        | null     | CHESTERFIELD | MO    | 63005-3628 | 3      | 189    | US      | 1T            | A           | 50002441    | null        | 2004-03-16       | 2001-03-22      | 1974-02-18     |   |
| 500 | N100KW   | D-10336         | 1151548             | 17032                |      1,980 |                4 |                       1 |                  3 | MIKRON AIR CORP               | 3505 TEXOMA PKWY        | null     | SHERMAN      | TX    | 75090      | 2      | 181    | US      | 1U            | A           | 50002652    | null        | 2003-12-16       | 1994-12-22      | 1980-01-29     |   |

**Aircraft Models**

| aircraft_model_code | manufacturer          | model | aircraft_type_id | aircraft_engine_type_id | aircraft_category_id | amateur | engines | seats | weight | speed |   |
|---------------------|-----------------------|-------|-----------------:|------------------------:|---------------------:|--------:|--------:|------:|-------:|------:|:-:|
| 05637J7             | WILCOX H L/WILCOX C N | CW    |                2 |                       0 |                    3 |       1 |       0 |     0 |      0 |     0 |   |
| 0563784             | WILCOX                | HW    |                2 |                       0 |                    1 |       1 |       0 |     0 |      0 |    60 |   |
| 0563788             | STOKES                | JS    |                2 |                       0 |                    1 |       1 |       0 |     0 |      0 |    60 |   |
| 05637F7             | KAMIN DENNIS ROBERT   | OZ    |                2 |                       0 |                    1 |       1 |       0 |     0 |      0 |     0 |   |
| 0610003             | MLB                   | 002   |                4 |                       1 |                    1 |       2 |       1 |     0 |      0 |     0 |   |

