# The Malloy Language
Malloy is a new experimental language for querying and modeling data.

Akin to a SQL “extension” it is far easier to use and reason about than SQL, usable in place of SQL, and is quick to pick up for SQL users.

It is reusable and modular, allowing you to model as you go, yet without heavy up-front work before you can start answering complex questions.

Malloy is for anyone who works with SQL--whether you’re an analyst, data scientist, data engineer, or someone building a data application, if you know SQL, Malloy will feel familiar, while more powerful and efficient.

This VSCode plugin is the first application of Malloy. It provides a rich environment to create Malloy models, query, and create simple visualizations and dashboards.

### How it works
- Queries **compile to SQL** and are issued directly to the database
- The language is reusable and composable: everything can be defined once (joins, metrics, aggregations) and later reused and extended.
- **Defaults are smart**, and Malloy  is **concise** where SQL is verbose and often redundant.
- Produces **rich metadata** about query results, as well as the originating column or field (think data lineage). This is ideal for building data applications, and enables construction of interfaces that allow the rewrite of queries to drill into row-level detail.
- ‍ Works in *nested structures* or “graphs” rather than in flat tables, which simplifies querying and aggregation at any nesting depth, and takes advantage of BigQuery’s strengths working with nested data.
- Automatically **builds search indexes** for all the data. Search indexes greatly simplify filtering data and can also be used to understand the ‘shape’ of any given field (min, max, cardinality, most frequent occurring values).
- Currently available on BigQuery, Malloy takes advantage of **BigQuery’s unique features**:
    - Reading and writing large nested result sets extremely fast
    - BI Engine & database-level caching

### Why do we need another data language?
SQL is complete but ugly: everything is expressible, but nothing is reusable; simple ideas are complex to expres; the language is verbose and lacks smart defaults. Malloy is immediately understandable by SQL users, and far easier to use and learn. It is usable in place of SQL to manipulate and explore data.

Key features and advantages:
- Query and model in the same language; everything is reusable and extensible.
- Malloy reads the schema so you don’t need to model everything: Malloy allows creation of re-usable metrics and logic, but there’s no need for boilerplate code that doesn’t add anything new.
- Pipelining: output one query into the next easily for powerful advanced analysis
- Turtles/Named Queries let you delve deeper into data quickly and nest data infinitely
- Queries do more: Power an entire dashboard with a single query. Nested queries are batched together, scanning the data only once.
- Indexes for unified suggest/search: Malloy automatically builds search indexes, making it easier to understand a dataset and filter values.
- Built to optimize the database: make the most of BigQuery, utilizing BI engine, caching, reading/writing nested datasets extremely fast, and more.
- Malloy models are purely about data; visualization and “styles” configurations live separately, keeping the model clean and easy to read.
- Aggregates are safe and accurate: Malloy generates distinct keys when they’re needed to ensure it never fans out your data.
- Nested tables are made approachable: you don’t have to model or flatten them; specify a query path and Malloy handles the rest.
- Compiler-based error checking: Malloy understands sql expressions so the compiler catches errors as you write, before the query is run.

# Join the Community
- Join the [**Malloy Slack Community!**](https://join.slack.com/t/malloy-community/shared_invite/zt-upi18gic-W2saeFu~VfaVM1~HIerJ7w) Use this community to ask questions, meet other Malloy users, and share ideas with one another.
- Use [**GitHub issues**](https://github.com/looker-open-source/malloy/issues) in this Repo to provide feedback, suggest improvements, report bugs, and start new discussions.


# Installation
## Building Malloy

You will need to have BigQuery credentials available, and the [gcloud CLI](https://cloud.google.com/sdk/gcloud) installed.

```
gcloud auth login --update-adc
gcloud config set project <project id> --installation
```

You will need to have [node.js](https://nodejs.org/en/download/), [yarn](https://classic.yarnpkg.com/en/docs/install/), and a [Java Runtime Environment](https://www.oracle.com/java/technologies/javase-jre8-downloads.html) (JRE 1.6 or higher, 1.8 recommended) installed on your system in order to build the Malloy project.

The following will install dependencies for the entire set of packages and compile both the Malloy language and the VSCode extension.

```bash
yarn install
yarn build
```

## Malloy VSCode Extension

The Malloy VSCode extension's source is in the `malloy-vscode` directory.

### Installation

To build and install the current version of the extension, first ensure that you've followed the steps to install the dependencies for the Malloy Repo. Then run:

```bash
yarn install
yarn build
```
_Note: You will need to re-run the above any time you pull in new changes._

Next, in VSCode _EITHER_:
1) Run the "Extensions: Install from VSIX" command (CTRL/CMD + SHIFT + P opens the command interface), then select `/malloy/packages/malloy-vscode/malloy-vscode-x.x.x.vsix`

_OR_

2) Open the `malloy-vscode` package root directory in VSCode, right click on `malloy-vscode-x.x.x.vsix` and select "Install Extension VSIX".

# Using the Malloy VSCode plugin

*add a little video here*

# Quick Start Video

*add a video here*

# Documentation
[Full documentation for Malloy](https://automatic-giggle-2ed8ec13.pages.github.io/documentation/index.html)

[Basics](https://automatic-giggle-2ed8ec13.pages.github.io/documentation/language/basic.html)

[Example Analysis](https://automatic-giggle-2ed8ec13.pages.github.io/documentation/examples/faa.html)

# Introduction: Basic Malloy Syntax & Using the VSCode Plugin

Malloy queries compile to SQL. As Malloy queries become more complex, the SQL complexity expands dramatically, while the Malloy query remains concise and easier to read.

A couple of key concepts: Queries in Malloy start with a data source, specified either `explore some_named_explore` or `explore 'some_table'`, followed by piped transformations on that data. Fields used in queries may be named using the `is` keyword, which is similar to `AS` in SQL, but reversed.

Let’s illustrate this by asking a straightforward question of a simple ecommerce dataset - how many order items have we sold, broken down by their current status?

```malloy
explore 'malloy-data.ecomm.order_items' | reduce
 status
 order_item_count is count(*)
```

The `reduce` transformation in the above query invokes a `SELECT` with a `GROUP BY` in SQL. Malloy also has a `project` transformation, which will `SELECT` without a `GROUP BY`.

Notice that after you write this, a small “Run” code lens will appear above the query. Click this to run the query. This will produce the following SQL:

```sql
SELECT
  base.status as status,
  COUNT( 1) as order_item_count
FROM malloy-data.ecomm.order_items as base
GROUP BY 1
ORDER BY 2 desc
```

_Note: To see the SQL being generated by your query, open up a New Terminal in the top menu, then select Output, and pick “Malloy” from the menu on the right._

![Kapture 2021-08-18 at 17 07 03](https://user-images.githubusercontent.com/7178946/130125702-7049299a-fe0f-4f50-aaed-1c9016835da7.gif)


Next question: In 2020, how much did we sell to users in each state? This requires filtering to the year 2020, excluding cancelled and returned orders, as well as joining in the users table.
```malloy
explore 'malloy-data.ecomm.order_items'
  users is join ('malloy-data.ecomm.users' primary key id) on user_id
| reduce : [created_at: @2020, status != 'Cancelled' & != 'Returned']
 users.state
 total_sales is sale_price.sum()
```

Note that queries can be filtered at any level, by inserting filter expressions between square brackets. A filter after an explore applies to the whole explore; one before the fields in a `reduce` or `project` transformation applies to that transformation; and one after an aggregate field applies to that aggregate only. See filters documentation for more information on filter expressions. Here's an example with a variety of filter usage:

```malloy
explore order_items : [users.state: 'California' | 'New York' | 'Texas', status: != 'Cancelled' & != 'Processing']
| reduce
  users.state
  total_sale_price_2020 is sale_price.sum() : [created_at : @2020]
  percent_items_returned is 100.0 * (count() : [status : 'Returned']) / count()
```


At this point we might notice we’re defining a few things we might like to re-use, so let’s add them to the model:
```
define users is (explore 'malloy-data.ecomm.users'
  primary key id
);

define order_items is (explore 'malloy-data.ecomm.order_items'
 primary key id
 total_sales is sale_price.sum()
 users is join on user_id);
```

Our query is now very simple:
```malloy
explore order_items | reduce : [created_at: @2020]
 users.state
 total_sales
```

To further simplify, we can add this and a couple other queries we’ll frequently use to our model. Once you define these, the VSCode plugin will supply a “Run” button next to each query:
```malloy

sales_by_state_2020 is (reduce: [created_at: @2020]
   users.state
   total_sales
 )

 orders_by_status is (reduce
   status
   order_count is count(distinct order_id)
 )

 sales_by_month_2020 is (reduce : [created_at : @2020]
   order_month is created_at.month
   total_sales
 )
```

Allowing us to run the following very simple command next time we want to run any of these queries:
```malloy
explore order_items | sales_by_state_2020
```

Our named queries can also now be used anywhere as a nested structure:
```malloy
explore order_items | reduce
 users.state
 total_sales
 orders_by_status
 sales_by_month_2020

```
<img width="844" alt="Screen Shot 2021-08-18 at 3 10 50 PM" src="https://user-images.githubusercontent.com/7178946/130128434-d409edfa-c4b9-4a92-af9a-7ceb241ea0e1.png">


Queries can contain other nested structures, by including additional transformations as fields, so our named query (`sales2020`) can also now be called anywhere as a nested structure. Note that these structures can nest infinitely!:
```malloy
explore order_items | reduce
 users.state
 total_sales
 sales2020
```

Which can be visualized using a data_style
```
{"sales_by_month_2020" : {
   "renderer" : "line_chart"}
, “orders_by_status” : {
   "renderer" : "bar_chart"}
}
```
<img width="899" alt="Screen Shot 2021-08-18 at 4 44 01 PM" src="https://user-images.githubusercontent.com/7178946/130128542-e122eab9-5cf2-48cb-b87c-ce520517d595.png">


Putting a few named queries together as nested structures allows us to produce a dashboard with an overview of sales, having written remarkably little code.

```
state_dashboard is (reduce
 users.state
 total_sales
 order_count
 orders_by_status
 sales_by_month_2020
)
```

<img width="865" alt="Screen Shot 2021-08-19 at 12 01 56 PM" src="https://user-images.githubusercontent.com/7178946/130128823-6b7f8e97-ec28-4ced-9e38-c72384eb976b.png">


### Malloy and Extension Development
_Note: You only need to do this for development on Malloy; it's not required to use the VSCode plugin._

1. Open the `/malloy/packages/malloy-vscode`  directory in VSCode
2. Select the "Run and Debug" panel in the left bar.
3. Click the green arrow "Run" button, with the "Run Extension" profile selected.

Optional: To additionally debug the language server, run the "Attach to Language Server"
launch profile from the "Run and Debug" panel.


![open_vsix3](https://user-images.githubusercontent.com/7178946/130678501-cd5cf79b-0d48-42a6-a4d5-602f1b0d563d.gif)


## Documentation Develoment

Documentation is a static site built by [Jekyll](https://jekyllrb.com/) with
some custom preprocessing.

Source for documentation lives in the `/docs/_src` directory. Any `.md`
files will be included in compiled documentation, `table_of_contents.json`
specifies the sidebar, and any other files will be copied as static files.

Custom preprocessing is done in `/docs/_scripts/build_docs/index.ts`.

### Installation

Jekyll is a Ruby Gem, so you will need to have Ruby 2.5.0+, RubyGems, GCC,
Make, and Bundler installed. See [here](https://jekyllrb.com/docs/installation/)
for more info on Jekyll's requirements.

To install Bundler, run
```
gem install bundler
```

Once all that is installed, you can install Jekyll and its Ruby dependencies:

```
bundle install
```

### Compile

To compile the documentation, run `yarn docs-build`. Your system must be
authenticated to a BigQuery instance with access to all the public tables referenced in the
`/samples` models.

### Develop

For developing the documentation, run `yarn docs-serve` build the docs, watch for
file changes in any of the docs, static files, or sample models, and serve the result
at [http://127.0.0.1:4000](http://127.0.0.1:4000). Jekyll hot-reloading is
enabled, so pages should automatically refresh when changes are made. When initial
compilation is complete, a browser should open to the home page.

Code blocks in the documentation may begin with a command string to indicate
whether the code should be run, and how the query should be compiled or the results
formatted. This command string is JSON-formatted and must appear on the first
line in a comment with an `!`, like: `--! { "isRunnable": true }`. For example,

~~~
```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size": "large"}
explore flights | sessionize
```
~~~

Currently, options include `isRunnable` (which must be `true` for the snippet
to run), `project` (which refers to a directory in `/samples`), `model` (
which refers to a file (not including the `.malloy` extension inside that
directory), and `size` (which adjusts the maximum scroll size of the results).

### Style

The following list describes style conventions used in the docs.

* Use headers (`# Foo`, `## Bar`, etc.) to organize document structure, not for
  emphasis. If you want to show emphasis, do it with `**bold**` or `_italics_`.
* Code spans (`` `explore flights` ``) are by default _Malloy_ syntax-highlighted. If
  you are writing a code span with code in any other language, use an HTML code tag,
  e.g. `<code>SELECT *</code>`

### Deploy

To deploy the docs, use the following steps:

1. Merge any docs changes into `main`
2. `git pull main`
2. `git checkout docs-release-static`
3. `git merge main`
4. `yarn docs-build`
5. `git add docs`
6. `git commit`
7. `git push`
