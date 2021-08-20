# Malloy

Malloy starts with the insight that all interactions of data are really
transformations of data from one form to the next, and uses that
to build a method for interacting with data which preserves the metadata
needed to properly compose and connect these transformations while
maintaining integrity of aggregate caclulations.

> This is an Experimental prototype. Experiments are focused on validating a prototype and are not guaranteed to be released. They are not intended for production use or covered by any SLA, support obligation, or deprecation policy and might be subject to backward-incompatible changes.

## Building Malloy

You will need to have BigQuery credentials available.

```
gcloud auth login --update-adc
gcloud config set project <project id> --installation
```

You will need to install [node.js](https://nodejs.org/en/download/), [yarn](https://classic.yarnpkg.com/en/docs/install/), and a [Java Runtime Environment](https://www.oracle.com/java/technologies/javase-jre8-downloads.html) (JRE 1.6 or higher, 1.8 recommended) on your system in order to build the Malloy project.

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
yarn workspace malloy-vscode build
yarn workspace malloy-vscode package
```

Then, in VSCode, run the "Extensions: Install from VSIX" command, and navigate to and select `/malloy/packages/malloy-vscode/malloy-vscode-x.x.x.vsix`.

Alternatively, open the `malloy-vscode` package root directory in VSCode, right click on `malloy-vscode-x.x.x.vsix` and select "Install Extension VSIX".

### Development

1. Open the `malloy-vscode` package root directory in VSCode.
2. Select the "Run and Debug" panel.
3. Click the green arrow run button for the "Run Extension" profile.

To additionally debug the language server, run the "Attach to Language Server"
launch profile.


## Documentation

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
authenticated to a BigQuery instance with access to all tables referenced in the 
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

## Basic Syntax

Queries in Malloy start with a data source, specified either `explore some_named_explore` or `explore 'some_table'`, followed by piped transformations on that data, e.g.

```malloy
explore 'users' | ...
```

Within such a transformation, fields may be referenced if they are defined in the data source:

```malloy
explore 'users' | project
  first_name,
  last_name,
  last_login_date,
  is_activated
```

Here, `project` is similar to `SELECT` in SQL. Expressions like those in BigQuery SQL are also allowed:

```malloy
explore 'products' | project
  name,
  discount_percentage * msrp
```

Fields used in queries may be named using the `is` keyword, which is similar to `AS` in SQL, but reversed:

```malloy
explore 'products' | project
  name,
  discounted_price is discount_percentage * msrp
```

In most cases, queries require aggregation. The `reduce` transformation is like a `SELECT` with a `GROUP BY` in SQL. The following query will yield each product brand name, the number of products with that brand name, and the average price of each product within the brand.

```malloy
explore 'products' | reduce
  name,
  product_count is count(),
  average_price is sum(msrp) / count()
```

Queries can contain other nested structures, by including additional transformations as fields:

```malloy
explore 'flights' | reduce
  carrier,
  flights_by_origin is (reduce
    origin_code,
    flight_count is count()
  )
```

Queries can be filtered at any level, by inserting filter expressions between square brackets. A filter after an explore applies to the whole explore; one before the fields in a `reduce` or `project` transformation applies to that transformation; and one after an aggregate field applies to that aggregate only. See Filters for more information on filter expressions.

```malloy
explore 'flights' [origin_state: 'CA'] | reduce
  carrier,
  flights_by_origin is (reduce [destination_code: 'ORD' | 'SFO' | 'JFK']
    origin_code,
    short_flight_count is count() [duration_minutes: '< 120']
  )
```

Using filters produces `WHERE` clauses at various points in the output SQL.

Every `reduce` or `project` transformation maintains metadata about the structure of the contained fields. This structure can be saved and given a name using the `define` keyword.

```malloy
define flights is (explore 'flights' | reduce
    carrier,
    flight_count is count()
);
```

The resulting structure can then be `explore`d.

```malloy
define flights is (...)
explore flights | reduce carrier, flight_count
```

To allow for reuse of such structures between queries, these definitions can be stored in a model file, and any exported structures can be used when querying against that model.

```malloy
export define flights is (explore 'flights' | reduce
    carrier,
    flight_count is count()
);
```

Similar structures can also be defined as enhancements to a table, by leaving off the `reduce`.

```malloy
define flights is (explore 'flights'
    carrier_code renames carrier,
    flight_count is count()
);

explore flights | reduce tail_number, flight_count
```

Lines beginning with `--` are treated as comments.

```malloy
-- Flights represents flights stored in the FAA registry
define flights is (explore 'flights'
    carrier_code renames carrier,
    flight_count is count()
);
```

Structures can be logically joined together in a structure definition:

```malloy
define carriers is (explore 'carriers'
    primary key code
    carrier_count is count()
);

define flights is (explore 'flights'
    flight_count is count()
    joins carriers on carrier
);
```
