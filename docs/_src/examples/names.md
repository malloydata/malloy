# Name Game

_You can find the complete source code for this model [here](https://github.com/looker-open-source/malloy/blob/docs-release/samples/names/names.malloy)._

The Data set consists of name, gender, state and year with the number of people that
were born with that name in that gender, state and year.

```malloy
--! {"isRunnable": true, "runMode": "auto",   "isPaginationEnabled": false, "pageSize": 100}
query: table('bigquery-public-data.usa_names.usa_1910_2013') -> {
  top: 10
  project: *
}
```

The command above says query the table `'bigquery-public-data.usa_names.usa_1910_2013'` and _project_ (show)
all the columns for the first 10 rows.

## Grouping a query
In SQL there are basically two kinds of <code>SELECT</code> commands: <code>SELECT ... GROUP BY</code> and <code>SELECT</code> without a grouping.
In Malloy, these are two different commands.  The command in Malloy for <code>SELECT ... GROUP BY</code> is `group_by`.  Since `number`
and `year` are reserved words, we have to quote the names with back-tics.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
query: table('bigquery-public-data.usa_names.usa_1910_2013') -> {
  group_by: name
  aggregate: population is `number`.sum()
}
```
Malloy compiles to SQL.  The SQL query for the above command is.

```sql
SELECT
   base.name as name,
   SUM(base.number) as population
FROM `bigquery-public-data.usa_names.usa_1910_2013` as base
GROUP BY 1
ORDER BY 2 desc
```

## Expressions
Expressions work much the same as they do in SQL.  We can look at population over decade by using a calculation against the year.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
query: table('bigquery-public-data.usa_names.usa_1910_2013') -> {
  top: 10
  group_by: decade is floor(`year` / 10) * 10
  aggregate: population is sum(`number`)
}
```

## Cohorts

```malloy
--! {"isRunnable": true, "runMode": "auto", "isPaginationEnabled": true, "pageSize":20, "size":"large" }
source: names is from(
  table('bigquery-public-data.usa_names.usa_1910_2013') -> {
    group_by:
      decade is floor(`year` / 10) * 10
      state
      gender
    aggregate: cohort_population is `number`.sum()
    nest: by_name is {
      group_by: name
      aggregate: population is `number`.sum()
    }
  }
) {
  measure: births_per_100k is floor(by_name.population.sum() / cohort_population.sum() * 100000)
  measure: total_cohort_population is cohort_population.sum()
  dimension: name is concat(by_name.name, '')
}

query: names -> {
  group_by:
    state
    gender
  aggregate: total_cohort_population
  nest: names is {
    where: name  ? 'Michael' | 'Lloyd' | 'Olivia'
    group_by: name
    aggregate: population is by_name.population.sum()
    group_by: births_per_100k
  }
}
```

## Dashboard

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "names/names.malloy", "isPaginationEnabled": false, "pageSize": 100, "size":"large"}
query: names -> name_dashboard { where: name ~ 'Mich%' }
```

## Iconic Names by State and Gender
Calculate the births per 100K for a name in general and a name within a state. Compute and sort by a ratio to figure out relative popularity.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "names/names.malloy", "isPaginationEnabled": false, "pageSize": 100, "size":"large"}
query: names { where: decade < 1970 } -> {
  group_by: name
  group_by: gender
  aggregate: births_per_100k
  nest: by_state is {
    group_by: state
    aggregate: births_per_100k
  }
} -> {
  where: births_per_100k > 50
  group_by: by_state.state
  nest: by_gender is {
    group_by: gender
    nest: by_name is {
      top: 15
      order_by: popularity desc
      group_by: name
      aggregate: popularity is (by_state.births_per_100k - births_per_100k) / births_per_100k
    }
  }
}
```
