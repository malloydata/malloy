# Meet Malloy

Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy is currently available on BigQuery and Postgres. About Malloy:

- Queries compile to SQL, optimized for your database
- Computations are modular, composable, reusable, and extendable in ways that are consistent with modern programming paradigms
- Excels at querying and producing nested data sets
- The fan and chasm traps are solved, making it possible to aggregate anything in one query and reducing need for fact tables and overly complex SQL
- Defaults are smart, and the language is concise (where SQL is verbose and often redundant)

Malloy is a language for anyone who works with SQL--whether you’re an analyst, data scientist, data engineer, or someone building a data application. If you know SQL, Malloy will feel familiar, while more powerful and efficient. Malloy allows you to model as you go, so there is no heavy up-front work before you can start answering complex questions, and you're never held back or restricted by the model.

We've built a Visual Studio Code extension to facilitate interacting with your data using Malloy. The extension provides a rich environment to create Malloy data models, query and transform data, and to create simple visualizations and dashboards.

# Syntax Example
We recommend starting with the [Quickstart](https://looker-open-source.github.io/malloy/documentation/language/basic.html) to get acquainted with the syntax. Here is a simple example of a Malloy query:

```malloy
query: table('malloy-data.faa.flights') -> {
  where: origin: 'SFO'
  group_by: carrier
  aggregate: [
    flight_count is count()
    average_flight_time is flight_time.avg()
  ]
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

# Get Started
GitHub mutes videos by default, so make sure to unmute to hear the walkthrough. 



https://user-images.githubusercontent.com/7178946/151630430-308e651d-814c-4c18-8522-d2d0edb25ece.mp4





# Installing the Extension

Currently, the Malloy extension works on Mac and Linux machines.

1. **Download Visual Studio Code**: If you don't already have it, download [Visual Studio Code](https://code.visualstudio.com/)

2. **Add the Malloy extension from the Visual Studio Code Marketplace**: Open VS Code and click the Extensions button on the far left (it looks like 4 blocks with one flying away). This will open the Extension Marketplace. Search for "Malloy" and, once found, click "Install"

3. **Connect to your database**: Directions [here](https://looker-open-source.github.io/malloy/documentation/connection_instructions.html).

4. **Write some Malloy!**: Start with the [Quickstart](https://looker-open-source.github.io/malloy/documentation/language/basic.html). It may be helpful to check out one of the walkthroughs under Documentation below, or try some of the BigQuery [sample models](https://github.com/looker-open-source/malloy/tree/main/samples) on public datasets available on the repo before getting started.

# Join the Community

- Join the [**Malloy Slack Community!**](https://join.slack.com/t/malloy-community/shared_invite/zt-upi18gic-W2saeFu~VfaVM1~HIerJ7w) Use this community to ask questions, meet other Malloy users, and share ideas with one another.
- Use [**GitHub issues**](https://github.com/looker-open-source/malloy/issues) in this Repo to provide feedback, suggest improvements, report bugs, and start new discussions.

# Documentation

[Malloy Documentation](https://looker-open-source.github.io/malloy/)

- [Basics](https://looker-open-source.github.io/malloy/documentation/language/basic.html) - A quick introduction to the language
- [eCommerce Example Analysis](https://looker-open-source.github.io/malloy/documentation/examples/ecommerce.html) - a walkthrough of the basics on an ecommerce dataset
- [Flights Example Analysis](https://looker-open-source.github.io/malloy/documentation/examples/faa.html) - examples built on the NTSB flights public dataset
- [Modeling Walkthrough](https://looker-open-source.github.io/malloy/documentation/examples/iowa/iowa.html) - introduction to modeling via the Iowa liquor sales public data set

# Why do we need another data language?

SQL is complete but ugly: everything is expressible, but nothing is reusable; simple ideas are complex to express; the language is verbose and lacks smart defaults. Malloy is immediately understandable by SQL users, and far easier to use and learn.

Key features and advantages:

- Query and model in the same language - everything is reusable and extensible.
- Malloy reads the schema so you don’t need to model everything. Malloy allows creation of re-usable metrics and logic, but there’s no need for boilerplate code that doesn’t add anything new.
- Pipelining: output one query into the next easily for powerful advanced analysis.
- Aggregating Subqueries let you build nested data sets to delve deeper into data quickly, and return complicated networks of data from single queries (like GraphQL).
- Queries do more: Power an entire dashboard with a single query. Nested queries are batched together, scanning the data only once.
- Indexes for unified suggest/search: Malloy automatically builds search indexes, making it easier to understand a dataset and filter values.
- Built to optimize the database: make the most of BigQuery, utilizing BI engine, caching, reading/writing nested datasets extremely fast, and more.
- Malloy models are purely about data; visualization and “styles” configurations live separately, keeping the model clean and easy to read.
- Aggregates are safe and accurate: Malloy generates distinct keys when they’re needed to ensure it never fans out your data.
- Nested tables are made approachable: you don’t have to model or flatten them; specify a query path and Malloy handles the rest.
- Compiler-based error checking: Malloy understands sql expressions so the compiler catches errors as you write, before the query is run.

# Contributing

If you would like to [work on Malloy](CONTRIBUTING.md), you can find some helpful instructions about [developing Malloy](developing.md) and [developing documentation](documentation.md).

Malloy is not an officially supported Google product.
