# Name Game

_You can find the complete source code for this model [here](https://github.com/looker-open-source/malloy/blob/docs-release/samples/names/names.malloy)._

The Data set consits of name, gender, state and year with the number of people that
were born with that name in that gender, state and year.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": false, "pageSize": 100}
explore 'bigquery-public-data.usa_names.usa_1910_2013'
| project * limit 10
```

## `project * limit 10`

The command above says _explore_ the table `'bigquery-public-data.usa_names.usa_1910_2013'` and _project_ (show)
all the columns for the first 10 rows.

## `reduce` a grouped by query.
In SQL there are basically two kinds of <code>SELECT</code> commands: <code>SELECT ... GROUP BY</code> and <code>SELECT</code> without a grouping.
In malloy, these are two different commands.  The command in mally for <code>SELECT ... GROUP BY</code> is `reduce`.  Since `number`
is a reserved word, we have to quote the name with back-tics.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
explore 'bigquery-public-data.usa_names.usa_1910_2013'
| reduce top 10
  name
  population is sum(`number`)
```
malloy compiles to SQL.  The SQL query for the above command is.

```sql
SELECT
   base.name as name,
   SUM(base.number) as population
FROM bigquery-public-data.usa_names.usa_1910_2013 as base
GROUP BY 1
ORDER BY 2 desc
LIMIT 10
```

## Expressions
Expressions work much the same as they do in SQL.  We can look at population over decade by using a
calculation against the year.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
explore 'bigquery-public-data.usa_names.usa_1910_2013'
| reduce top 10
  decade is FLOOR(`year`/10)*10
  population is sum(`number`)
```

## Cohorts

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "pageSize":20, "size":"large" }
define names is ((explore 'bigquery-public-data.usa_names.usa_1910_2013'
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
    births_per_100k is FLOOR(by_name.population.sum()/cohort_population.sum() *100000)
    total_cohort_population is cohort_population.sum()
    name is concat(by_name.name,'') -- bug
);

explore names
| reduce
  state
  gender
  total_cohort_population
  names is (reduce : [name : 'Michael'|'Lloyd'|'Olivia']
    name
    population is by_name.population.sum()
    births_per_100k
  )
```

## Dashboard

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "names/names.malloy", "isPaginationEnabled": false, "pageSize": 100, "size":"large"}
explore names : [name ~ 'Mich%'] | name_dashboard
```

## Iconic Names by State and Gender
Calculate the births per 100K for a name in general and a name within a state.
Compute and sort by a ratio to figure out relative popularity.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "names/names.malloy", "isPaginationEnabled": false, "pageSize": 100, "size":"large"}
explore names : [decade < 1970]
| reduce
  name,
  gender
  births_per_100k
  by_state is (reduce
    state
    births_per_100k
  )
| reduce : [births_per_100k > 50]
  by_state.state
  by_gender is (reduce
    gender
    by_name is (reduce top 15 order by 2 desc
      name
      popularity is (by_state.births_per_100k - births_per_100k) /births_per_100k
    )
  )
```
