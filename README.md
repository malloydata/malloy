# Meet Malloy

Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language that runs queries against a relational database. Malloy is currently available on BigQuery and Postgres. About Malloy:

- Queries compile to SQL, optimized for your database
- Computations are modular, composable, reusable, and extendable in ways that are consistent with modern programming paradigms
- Excels at querying and producing nested data sets
- The fan and chasm traps are solved, making it possible to aggregate anything in one query and reducing need for fact tables and overly complex SQL
- Defaults are smart, and the language is concise (where SQL is verbose and often redundant)

Malloy is a language for anyone who works with SQL--whether you’re an analyst, data scientist, data engineer, or someone building a data application. If you know SQL, Malloy will feel familiar, while more powerful and efficient. Malloy allows you to model as you go, so there is no heavy up-front work before you can start answering complex questions, and you're never held back or restricted by the model.

We've built a Visual Studio Code extension to facilitate interacting with your data using Malloy. The extension provides a rich environment to create Malloy data models, query and transform data, and to create simple visualizations and dashboards.

_GitHub mutes videos by default, so make sure to unmute._

https://user-images.githubusercontent.com/7178946/154564840-41299974-58ce-41d1-ab08-98f2be6f9157.mov

In addition, we've built an example of an application built on top of the language, the [Composer Demo](https://github.com/looker-open-source/malloy/tree/main/demo/malloy-demo-composer). Learn to use it [here](https://docs.google.com/presentation/d/18KUl_rrz2K-hbsiKJYS3rtTcYxZMXKklyPllLmTtIYY/edit#slide=id.g1269816dcbe_0_140), and check out the demo. 

https://user-images.githubusercontent.com/7178946/170374545-412cf60b-8649-48a3-acb6-9908e102af7c.mov


# Syntax Example
We recommend starting with the [Quickstart](https://looker-open-source.github.io/malloy/documentation/language/basic.html) to get acquainted with the syntax. Here is a simple example of a Malloy query:

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

# Get Started
This walkthrough covers installing the extension, connecting a database, and the basics of using Malloy in VS Code.

_GitHub mutes videos by default, so make sure to unmute._

https://user-images.githubusercontent.com/7178946/151630430-308e651d-814c-4c18-8522-d2d0edb25ece.mp4



# Installing the Extension

Currently, the Malloy extension works on Mac and Linux machines.

1. **Download Visual Studio Code**: If you don't already have it, download [Visual Studio Code](https://code.visualstudio.com/)

2. **Add the Malloy extension from the Visual Studio Code Marketplace**: Open VS Code and click the Extensions button on the far left (it looks like 4 blocks with one flying away). This will open the Extension Marketplace. Search for "Malloy" and, once found, click "Install"

3. **Connect to your database**: Directions [here](https://looker-open-source.github.io/malloy/documentation/connection_instructions.html).

4. **Write some Malloy!**: Start with the [Quickstart](https://looker-open-source.github.io/malloy/documentation/language/basic.html). It may be helpful to check out one of the walkthroughs under Documentation below, or try some of the BigQuery [sample models](https://github.com/looker-open-source/malloy/tree/main/samples) on public datasets available on the repo before getting started.

## Quickstart Tips

Get up and running quickly with these steps.  Install the VS Code extension if you have not yet done so.  

Malloy models in the documentation reference source data that lives in public BigQuery tables; so, if you have a Google Cloud account (or wish to make one), connecting the extension to **BigQuery** via your Google Cloud account is the fastest way to try out Malloy.  Otherwise, the sample Malloy models can be easily modified to work with a **Postgres** instance (see steps below).  **DuckDB** is also supported and is another great way to test out the language quickly!

### BigQuery
1. [Create](https://cloud.google.com) a Google Cloud account if you don't have one already
2. Associate the [gcloud CLI](https://cloud.google.com/sdk/gcloud) with your account and configure gcloud to connect to Google Cloud services via a project.  The `project_id` value to enter in the CLI is found on the Google Cloud dashboard (in the screenshot below, the `project_id` would be "my-malloy-test-project")

![google_cloud_project_id](https://user-images.githubusercontent.com/25882507/179831184-6206fff3-5f24-4a94-97c6-026502cf6df6.png)

```bash
gcloud auth login --update-adc
gcloud config set project <project_id>
```

3. Connect to BigQuery in the extension.  You can leave optional fields blank, as the extension will connect using the gcloud project configuration

![bigquery-connection-example](https://user-images.githubusercontent.com/25882507/179831243-a25631dc-83ed-4164-a3f8-066e5192cfab.png)

4. Copy any of the Malloy [sample models](https://github.com/looker-open-source/malloy/blob/docs-release/samples/faa/flights.malloy) from the [documentation](https://looker-open-source.github.io/malloy/documentation/examples/faa.html) and save the file locally, ensuring the filetype is `.malloy` to enable Malloy extension features.  There are multiple sample models that all use data from public BigQuery tables, so everything should run without issue
5. Run the models as shown in the walkthrough video

### PostgreSQL
You can also run the Malloy sample models locally in Postgres once you load the database with the appropriate datasets.  These steps setup a database with the NTSB Flight dataset and respective sample models.  These steps use Docker for convenience, but the instructions can be modified to run a Postgres instance directly.

1. From the `malloy/` root directory of the repository, unzip the SQL script that will load the NTSB Flight dataset

```bash
gunzip test/data/postgres/malloytest-postgres.sql.gz
```

2. Start a Docker container running Postgres

```bash
docker run --name malloy-postgres -e POSTGRES_PASSWORD=password -d -p 5432:5432 postgres
```

3. Copy the SQL data file into the container

```bash
docker cp test/data/postgres/malloytest-postgres.sql malloy-postgres:/malloytest-postgres.sql
```
4. Run the file in the container

```bash
docker exec -it malloy-postgres psql -U postgres -f malloytest-postgres.sql
```
5. Connect to Postgres in the extension

![postgres-connection-example](https://user-images.githubusercontent.com/25882507/179831294-b6a69ef6-f454-48a7-8b93-aec2bff0ff3f.png)

6. Copy the NTSB Malloy [sample models](https://github.com/looker-open-source/malloy/blob/docs-release/samples/faa/flights.malloy) from the [documentation](https://looker-open-source.github.io/malloy/documentation/examples/faa.html) and save the file locally, ensuring the filetype is `.malloy` to enable Malloy extension features.  Since only the NTSB data was loaded, only these NTSB models will run against the database
7. The sample models reference public BigQuery tables using the standard _project_name.dataset_name.table_name_ BigQuery format, so all source data references prefixed with `malloy-data.faa.` must be changed to `malloytest.` to conform to Malloy's Postgres _schema_name.table_name_ format (the database name is not required).  Simply find and replace in VS Code or run `sed -i -e 's/malloy-data.faa./malloytest./g' path/to/<your_file.malloy>`

![source_table_reference](https://user-images.githubusercontent.com/25882507/179834102-eef4aee4-973a-4259-bfe4-1487179012b3.png)

8. Run the models as shown in the walkthrough video

### DuckDB
Malloy natively supports DuckDB, allowing you to run Malloy models against DuckDB tables created from flat files (e.g. CSV, Parquet).  You can get started quickly by modifying two source definitions (below) from the [Wordle Solver](https://looker-open-source.github.io/malloy/documentation/examples/wordle/wordle.html) example in the documentation.  The below statements redefine the `words` and `numbers` sources using DuckDB instead of BigQuery.

1. Instead of loading the word list from BigQuery, import the local word file directly into DuckDB

```malloy
// INSTEAD OF THIS
// source: words is table('malloy-data.malloytest.words_bigger')

// USE THIS
sql: words_sql is  || 
  SELECT * FROM read_csv_auto(
    '/usr/share/dict/words',
    ALL_VARCHAR=1 
  )
  ;;
  on "duckdb"
  
source: words is from_sql(words_sql) {
  dimension: word is column0
  query: five_letter_words is {
    where: length(word) = 5
    project: word
  }
}
```

2. Instead of loading the numbers table from BigQuery, generate the same table using SQL

```malloy
// INSTEAD OF THIS
// source: numbers is table('malloy-data.malloytest.numbers') {
//   where: num <= 5
// }

// USE THIS
sql: nums_sql is  || 
  WITH recursive nums AS
   (SELECT 1 AS num
    UNION ALL
    SELECT num + 1 AS num
    FROM nums
    WHERE nums.num < 5)
  SELECT *
  FROM nums
  ;;
  on "duckdb"
  
source: numbers is from_sql(nums_sql) {}
```

3. The rest of the example code will run as expected


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

To report security issues please see our [security policy](https://github.com/looker-open-source/malloy/security/policy).

Malloy is not an officially supported Google product.
