# Malloy
Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy currently connects to BigQuery and Postgres, and natively supports DuckDB. We've built a Visual Studio Code extension to facilitate building Malloy data models, querying and transforming data, and creating simple visualizations and dashboards.


## Try Malloy

Currently, the Malloy extension works on Mac, Linux, and Windows machines.

1. **Download Visual Studio Code**: Download [Visual Studio Code](https://code.visualstudio.com/)

2. **Add the Malloy extension from the Visual Studio Code Marketplace**: Open VS Code and click the Extensions button on the far left (it looks like 4 blocks with one flying away). This will open the Extension Marketplace. Search for "Malloy" and, once found, click "Install"

3. **Download the [names example](https://github.com/looker-open-source/malloy/tree/main/samples_duckdb/names_duckdb)** (model + data). Open the model then click the "Run" code lens above any query to run it in VS Code.

4. **Write some Malloy!** Play with an additional example ([DuckDB](https://github.com/looker-open-source/malloy/tree/add_malloy_examples/samples_duckdb) |  [BigQuery](https://looker-open-source.github.io/malloy/documentation/samples.html)), [use a CSV or parquet](https://looker-open-source.github.io/malloy/documentation/connection_instructions.html#duckdb), or connect [database](https://looker-open-source.github.io/malloy/documentation/connection_instructions.html).


## Join the Community

- Join our [**Malloy Slack Community!**](https://join.slack.com/t/malloy-community/shared_invite/zt-upi18gic-W2saeFu~VfaVM1~HIerJ7w) Use this community to ask questions, meet other Malloy users, and share ideas with one another.
- Use [**GitHub issues**](https://github.com/looker-open-source/malloy/issues) in this Repo to provide feedback, suggest improvements, report bugs, and start new discussions.

## Resources

[YouTube](https://www.youtube.com/channel/UCfN2td1dzf-fKmVtaDjacsg) - Watch demos / walkthroughs of Malloy

Highlighted Documentation:

- [Basics](https://looker-open-source.github.io/malloy/documentation/language/basic.html) - A quick introduction to the language
- [eCommerce Example Analysis](https://looker-open-source.github.io/malloy/documentation/examples/ecommerce.html) - a walkthrough of the basics on an ecommerce dataset
- [Flights Example Analysis](https://looker-open-source.github.io/malloy/documentation/examples/faa.html) - examples built on the NTSB flights public dataset
- [Modeling Walkthrough](https://looker-open-source.github.io/malloy/documentation/examples/iowa/iowa.html) - introduction to modeling via the Iowa liquor sales public data set



## Syntax Example
Here is a simple example of a Malloy query:

```malloy
query: table('malloy-data.faa.flights') -> {
  where: origin ? 'SFO'
  group_by: carrier
  aggregate:
    flight_count is count()
    average_flight_time is flight_time.avg()
}
```

In SQL this would be expressed:
```sql
SELECT
   carrier,
   COUNT(*) as flight_count,
   AVG(flight_time) as average_flight_time
FROM `malloy-data.faa.flights`
WHERE origin = 'SFO'
GROUP BY carrier
ORDER BY flight_count desc         -- malloy automatically orders by the first aggregate
```

Learn more about the syntax and language features of Malloy in the [Quickstart](https://looker-open-source.github.io/malloy/documentation/language/basic.html).


# Contributing

If you would like to [work on Malloy](CONTRIBUTING.md), take a look at the instructions for [developing Malloy](developing.md) and [developing documentation](documentation.md).

To report security issues please see our [security policy](https://github.com/looker-open-source/malloy/security/policy).

Malloy is not an officially supported Google product.
