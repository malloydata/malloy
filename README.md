# Malloy

Malloy is a modern open source language for describing data relationships and transformations. It is both a semantic modeling language and a query language that uses an existing SQL engine to execute queries. Malloy currently can connect to BigQuery, Snowflake, PostgreSQL, MySQL, Trino, or Presto, and natively supports DuckDB. We've built a Visual Studio Code extension to facilitate building Malloy data models, querying and transforming data, and creating simple visualizations and dashboards.

### [Click here](https://github.dev/malloydata/try-malloy/airports.malloy) to try Malloy in your browser!

---

## Installing Malloy

The easiest way to try Malloy is with our VS Code Extension, which provides a place to create Malloy models, execute queries, get help, and more. VS Code is a text editor and IDE (integrated development environment) that runs on your desktop or in your browser. A few ways to install the extension:

- [I already have VS Code](https://docs.malloydata.dev/documentation/setup/extension.html#using-the-malloy-extension-on-your-desktop)
- [I use BigQuery and Google Cloud](https://docs.malloydata.dev/documentation/setup/extension.html#using-the-malloy-extension-on-google-cloud-shell-editor).
- [I have a Github account and want to try Malloy on a `.csv` or `.parquet` file in a repository](https://docs.malloydata.dev/documentation/setup/extension.html#using-the-malloy-extension-on-github-dev).

![show_run](https://user-images.githubusercontent.com/1093458/182458787-ca228186-c954-4a07-b298-f92dbf91e48d.gif)

To get to know the Malloy language, follow [our Quickstart](https://docs.malloydata.dev/documentation/user_guides/basic.html).

Note: The Malloy VSCode Extension tracks a small amount of anonymous usage data. You can opt out in the extension settings.
[Learn more](https://policies.google.com/technologies/cookies).

## Join the Community

- Join our [**Malloy Slack Community!**](https://malloydata.github.io/slack) Use this community to ask questions, meet other Malloy users, and share ideas with one another.
- Use [**GitHub issues**](https://github.com/malloydata/malloy/issues) in this Repo to provide feedback, suggest improvements, report bugs, and start new discussions.

## Resources

Documentation:

- [Malloy Language](https://docs.malloydata.dev/documentation/) - A quick introduction to the language
- [eCommerce Example Analysis](https://docs.malloydata.dev/documentation/examples/ecommerce.html) - a walkthrough of the basics on an ecommerce dataset (BigQuery public dataset)
- [Modeling Walkthrough](https://docs.malloydata.dev/documentation/examples/iowa/iowa.html) - introduction to modeling via the Iowa liquor sales public data set (BigQuery public dataset)

[YouTube](https://www.youtube.com/channel/UCfN2td1dzf-fKmVtaDjacsg) - Watch demos / walkthroughs of Malloy

## Contributing

If you would like to [work on Malloy](CONTRIBUTING.md), take a look at the instructions for [developing Malloy](developing.md).

## Syntax Example

Here is a simple example of a Malloy query:

```malloy
run: bigquery.table('malloydata-org.faa.flights') -> {
  where: origin = 'SFO'
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

Learn more about the syntax and language features of Malloy in the [Quickstart](https://docs.malloydata.dev/documentation/user_guides/basic).
