# Malloy
Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy currently supports BigQuery and Postgres, as well as querying Parquet and CSV files via DuckDB.

### [Click here](https://github.dev/malloydata/try-malloy/airports.malloy) to try Malloy in your browser!

---

## Installing Malloy

The easiest way to try Malloy is with our VS Code Extension, which provides a place to create Malloy models, execute queries, get help, and more. VS Code is a text editor and IDE (integrated development environment) that runs on your desktop or in your browser. A few ways to install the extension:

* [I already have VS Code](https://malloydata.github.io/documentation/setup/extension.html#using-the-malloy-extension-on-your-desktop)
* [I use BigQuery and Google Cloud](https://malloydata.github.io/documentation/setup/extension.html#using-the-malloy-extension-on-google-cloud-shell-editor).
* [I have a Github account and want to try Malloy on a `.csv` or `.parquet` file in a repository](https://malloydata.github.io/documentation/setup/extension.html#using-the-malloy-extension-on-github-dev).

![show_run](https://user-images.githubusercontent.com/1093458/182458787-ca228186-c954-4a07-b298-f92dbf91e48d.gif)

To get to know the Malloy language, follow [our Quickstart](https://malloydata.github.io/documentation/user_guides/basic.html).

Note: The Malloy VSCode Extension tracks a small amount of anonymous usage data. You can opt out in the extension settings.
 [Learn more](https://policies.google.com/technologies/cookies).

## Join the Community

- Join our [**Malloy Slack Community!**](https://join.slack.com/t/malloy-community/shared_invite/zt-1kgfwgi5g-CrsdaRqs81QY67QW0~t_uw) Use this community to ask questions, meet other Malloy users, and share ideas with one another.
- Use [**GitHub issues**](https://github.com/malloydata/malloy/issues) in this Repo to provide feedback, suggest improvements, report bugs, and start new discussions.

## Resources

Documentation:

- [Malloy Language](https://malloydata.github.io/documentation/language/basic.html) - A quick introduction to the language
- [eCommerce Example Analysis](https://malloydata.github.io/documentation/examples/ecommerce.html) - a walkthrough of the basics on an ecommerce dataset (BigQuery public dataset)
- [Modeling Walkthrough](https://malloydata.github.io/documentation/examples/iowa/iowa.html) - introduction to modeling via the Iowa liquor sales public data set (BigQuery public dataset)

[YouTube](https://www.youtube.com/channel/UCfN2td1dzf-fKmVtaDjacsg) - Watch demos / walkthroughs of Malloy

## Contributing

If you would like to [work on Malloy](CONTRIBUTING.md), take a look at the instructions for [developing Malloy](developing.md) and [developing documentation](documentation.md).

To report security issues please see our [security policy](https://github.com/malloydata/malloy/security/policy).

Malloy is not an officially supported Google product.

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

Learn more about the syntax and language features of Malloy in the [Quickstart](https://malloydata.github.io/documentation/language/basic.html).
