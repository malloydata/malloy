# Cohort Analysis

One of the most powerful way of understanding what is happening using data is to use *cohort analysis*.
Fundamentally, cohort analysis is used to group people into sets and to analyze the success,
attributes or characteristics of that group as compared to the population in general.

To understand this, we're going to use Social Security Administrations birth/name data.

We have a table with `name`, `gender`, `` `year` ``, `state` and the `` `number` `` of people born with those
characteristics.

In the simplest form, a cohort calculation is a [percentage of total calculation](percent_of_total.md).
For example, if we were interested in the name 'Billie' as it relates to location. We could look
could filter on 'Billie' and look a states as it relates to total population.

We can see that in the population of the the people named 'Billie', the cohort of the Billies born in
Texas makes up 18% of the total population of Billies.

```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto",   "isPaginationEnabled": true, "pageSize":20, "size":"small" }
query: table('bigquery:bigquery-public-data.usa_names.usa_1910_2013') -> {
  where: name = 'Billie'
  aggregate: total_population is `number`.sum()
  nest: main_query is {
    group_by: state
    aggregate: total_population is `number`.sum()
  }
} -> {
  project:
    main_query.state
    main_query.total_population
    state_as_percent_of_population is main_query.total_population / total_population * 100.0
  order_by: state_as_percent_of_population desc
}
```

We could run this same query, but instead look by decade to see when the Billies where born.
Using the query below we can see that 26% of all Billies were born in the 1930s.

```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto",   "isPaginationEnabled": true, "pageSize":20, "size":"small" }
query: table('bigquery:bigquery-public-data.usa_names.usa_1910_2013') -> {
  where: name = 'Billie'
  aggregate: total_population is `number`.sum()
  nest: main_query is {
    group_by: decade is floor(`year` / 10) * 10
    aggregate: total_population is `number`.sum()
  }
} -> {
  project:
    main_query.decade
    main_query.total_population
    decade_as_percent_of_population is main_query.total_population / total_population * 100.0
  order_by: decade_as_percent_of_population desc
}
```

## Names as Cohorts

In the above example, the population was *People named Billie* and we used *state* or *year* for our cohort (grouping).
Lets flip it around and look at people born with a particular name as a cohort and the other attributes to limit our population.
Let's limit our population to California in 1990 and look at the most cohorts (people with a given name).  We are also going
to measure a little differently.  Instead of looking at a percentage, let's look at births per 100,000 people.

```malloy
--! {"isRunnable": true, "showAs":"json", "runMode": "auto",   "isPaginationEnabled": true, "pageSize":20, "size":"small" }
query: table('bigquery:bigquery-public-data.usa_names.usa_1910_2013') -> {
  where: state = 'CA' and `year` = 1990
  aggregate: total_population is `number`.sum()
  nest: main_query is {
    group_by: name
    aggregate: total_population is `number`.sum()
  }
} -> {
  project:
    main_query.name
    main_query.total_population
    births_per_100k is FLOOR(main_query.total_population / total_population * 100000.0)
  order_by: births_per_100k desc
}
```
