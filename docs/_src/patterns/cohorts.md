# Cohort Analysis

One of the most powerful way of understanding what is happening using data is to use *cohort analisys*.
Fundementally, cohort analysis is used to group people into sets and to analyse the success,
attributes or characteristics of that group as compared to the population in general.

To understand this, we're going to use Social Security Administrations birth/name data.

We have a table with `name`, `gender`, `` `year` ``, `state` and the `` `number` `` of people born with those
characterisitics.

In the simplelist form, a cohort calculation is a [percentage of total calculation](percet_of_total.md).  
For example, if we were interested in the name 'Billie' as it relates to location. We could look
could filter on 'Billie' and look a states as it relates to total population.

We can see that in the population of the the people named 'Billie', the cohort of the Billies born in
Texas makes up 18% of the total population of Billies.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":20, "size":"small" }
explore 'bigquery-public-data.usa_names.usa_1910_2013'
| reduce : [name: 'Billie']
  total_population is `number`.sum()
  main_query is (reduce
    state
    total_population is `number`.sum()
  )
| project order by 3 desc
  main_query.state
  main_query.total_population
  state_as_percent_of_population is main_query.total_population/total_population * 100.0
```

We could run this same query, but instead look by decade to see when the Billies where born.
Using the query below we can see that 26% of all Billies were born in the 1930s.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":20, "size":"small" }
explore 'bigquery-public-data.usa_names.usa_1910_2013'
| reduce : [name: 'Billie']
  total_population is `number`.sum()
  main_query is (reduce
    decade is FLOOR(`year`/10) * 10
    total_population is `number`.sum()
  )
| project order by 3 desc
  main_query.decade
  main_query.total_population
  decade_as_percent_of_population is main_query.total_population/total_population * 100.0
```

## Names as Cohorts

In the above example, the population was *People named Billie* and we used *state* or *year* for our cohort (grouping).
Lets flip it around and look at people born with a particular name as a cohort and the other attributes to limit our popuation.
Let's limit our population to California in 1990 and look at the most cohorts (people with a given name).  We are also going
to measure a little differently.  Instead of looking at a percentage, let's look at births per 100,000 people.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":20, "size":"small" }
explore 'bigquery-public-data.usa_names.usa_1910_2013'
| reduce : [state: 'CA', `year`:1990]
  total_population is `number`.sum()
  main_query is (reduce
    name
    total_population is `number`.sum()
  )
| project order by 3 desc
  main_query.name
  main_query.total_population
  births_per_100k is FLOOR(main_query.total_population/total_population * 100000.0)
```

MORE TO COME


First we calculate populations of cohorts (decade, state, gender) and then for
every name in that cohort, we compute the population.

Seconds, we group by arbitrary cohorts and compute the births per 100K for some arbitrary names.


```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": true, "pageSize":20, "size":"large" }
explore ('bigquery-public-data.usa_names.usa_1910_2013' 
| reduce
    decade is floor(`year`/10)*10
    state
    gender
    cohort_population is `number`.sum()
    by_name is (reduce
      name
      population is `number`.sum()
    )
  )
| reduce
  state
  gender
  total_cohort_population is cohort_population.sum()
  names is (reduce :  [by_name.name : 'Michael'|'Lloyd'|'Olivia']
    by_name.name
    population is by_name.population.sum()
    births_per_100k is FLOOR(by_name.population.sum()/cohort_population.sum() *100000)
  )
```
