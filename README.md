# Welcome to Malloy

Malloy is an experimental language for describing data relationships and transformations. Malloy is not an officially supported Google product.

* Malloy presents some new abstractions for data computation which provide astonishing power with a few simple concepts.
* Malloy computations are modular, composable, reusable, and extendable in ways that are consistent with modern programming paradigms.
* Malloy sees data as a network of relationships, and generates network graphs with results, so it can ensure correctness of aggregate computations through multiple levels of transformation.

Malloy also includes a VS Code IDE for writing and running models, queries, and transformations.

The Malloy language began as a platform for refining the question "Can we make a language which describes the actual computations need to derive useful information from data stored in a relational database?" While we are continuing to ask that question, and to refine the language as we gain experience, Malloy has reached a point where it can be useful to people engaged in the the task of making meaning from data.

The next steps are going to be determined to a large degree by the success of the language in making data computation simpler and easier to manage, and by the needs of those who pick this project up and incorporate it into their workflows.

# The Malloy Language

**Quick Links**: [language documentation](https://looker-open-source.github.io/malloy/documentation/index.html) | [example model](https://looker-open-source.github.io/malloy/documentation/examples/faa.html)

Akin to a SQL “extension,” it is far easier to use and reason about than SQL, it is usable in place of SQL, and it is quick to pick up for SQL users.

It is reusable and modular, allowing you to model as you go, yet without heavy up-front work before you can start answering complex questions.

Malloy is for anyone who works with SQL--whether you’re an analyst, data scientist, data engineer, or someone building a data application. If you know SQL, Malloy will feel familiar, while more powerful and efficient.

This VSCode plugin is the first application of Malloy. It provides a rich environment to create Malloy models, query, and create simple visualizations and dashboards.

### How it works

- Queries **compile to SQL** and are issued directly to the database
- The language is reusable and composable: everything can be defined once (joins, metrics, aggregations) and later reused and extended.
- **Defaults are smart**, and Malloy is **concise** where SQL is verbose and often redundant.
- Produces **rich metadata** about query results, as well as the originating column or field (think data lineage). This is ideal for building data applications, and enables construction of interfaces that allow the rewrite of queries to drill into row-level detail.
- ‍ Works in _nested structures_ or “graphs” rather than in flat tables, which simplifies querying and aggregation at any nesting depth, and takes advantage of BigQuery’s strengths working with nested data.
- Automatically **builds search indexes** for all the data. Search indexes greatly simplify filtering data and can also be used to understand the ‘shape’ of any given field (min, max, cardinality, most frequent occurring values).
- Currently available on BigQuery and soon to be available on Postgres.
- Malloy takes advantage of **BigQuery’s unique features**:
  - Reading and writing large nested result sets extremely fast
  - BI Engine & database-level caching

### Why do we need another data language?

SQL is complete but ugly: everything is expressible, but nothing is reusable; simple ideas are complex to express; the language is verbose and lacks smart defaults. Malloy is immediately understandable by SQL users, and far easier to use and learn. It is usable in place of SQL to manipulate and explore data.

Key features and advantages:

- Query and model in the same language; everything is reusable and extensible.
- Malloy reads the schema so you don’t need to model everything: Malloy allows creation of re-usable metrics and logic, but there’s no need for boilerplate code that doesn’t add anything new.
- Pipelining: output one query into the next easily for powerful advanced analysis.
- Aggregating Subqueries let you build nested data sets to delve deeper into data quickly, and return complicated networks of data from single queries (like GraphQL).
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
gcloud config set project my_project_id --installation
```

_Replace `my_project_id` with the name of the bigquery project you want to use & bill to. If you're not sure what this ID is, open Cloud Console, and click on the dropdown at the top to view projects you have access to. If you don't already have a project, [create one](https://cloud.google.com/resource-manager/docs/creating-managing-projects)._

You will need to have [node.js](https://nodejs.org/en/download/), [yarn](https://classic.yarnpkg.com/en/docs/install/), and a [Java Runtime Environment](https://www.oracle.com/java/technologies/javase-jre8-downloads.html) (JRE 1.6 or higher, 1.8 recommended) installed on your system in order to build the Malloy projecti.

Alternatively, you can use [nix](https://nixos.org/) to install these dependencies. To use nix, install it with `curl -L https://nixos.org/nix/install | sh` and then run `nix-shell` from the `malloy/` directory. Nix is what _CI_ uses to run builds.

The following will install dependencies for the entire set of packages and compile both the Malloy language and the VSCode extension.

```bash
yarn install
```

## Malloy VSCode Extension

The Malloy VSCode extension's source is in the `malloy-vscode` directory.

### Installation

To build and install the current version of the extension, first ensure that you've followed the steps to install the dependencies for the Malloy Repo. **Note: You will need to re-run the below any time you pull in new changes.** Then run:

```bash
yarn install
yarn build-extension
```

Next, in VSCode _EITHER_:

1. Run the "Extensions: Install from VSIX" command (CTRL/CMD + SHIFT + P opens the command interface), then select `/malloy/packages/malloy-vscode/malloy-vscode-x.x.x.vsix`

_OR_

2. Open the `malloy-vscode` package root directory in VSCode, right click on `malloy-vscode-x.x.x.vsix` and select "Install Extension VSIX".

### Contributing

If you would like to [work on Malloy](CONTRIBUTING.md), you can find some helpful instructions about [developing Malloy](developing.md) and [developing documentation](documentation.md).

# Documentation

[Full documentation for Malloy]( https://looker-open-source.github.io/malloy/)

- [eCommerce Example Analysis](https://looker-open-source.github.io/malloy/documentation/examples/ecommerce.html) - a walkthrough of basics on an ecommerce dataset
- [Basics](https://looker-open-source.github.io/malloy/documentation/language/basic.html) - docs introduction to the language
- [Flights Example Analysis](https://looker-open-source.github.io/malloy/documentation/examples/faa.html) - examples built on the NTSB flights public dataset
- [Modeling Walkthrough](https://looker-open-source.github.io/malloy/documentation/examples/iowa/iowa.html) - introduction to modeling via the Iowa liquor sales public data set

# Quick Start Videos

## Using the Malloy VSCode plugin

https://user-images.githubusercontent.com/7178946/130858341-4e2a834a-ca51-44af-b035-584d6908873f.mov

https://user-images.githubusercontent.com/7178946/130858354-d92d9ac2-583f-4169-834a-579927b727cd.mov

## Getting Started Video Series

 These videos are intended to be viewed in order, but split up to easily navigate (and also because GitHub only allows 100MB video uploads). If you prefer a written format, the [eCommerce Walkthrough](https://looker-open-source.github.io/malloy/documentation/examples/ecommerce.html) covers similar concepts around Malloy and using the VSCode plugin. _You can also watch this as a single video on Youtube,_ [here](https://www.youtube.com/watch?v=0Ck8CBa4qRo&t=3s).

**You will need to un-mute the audio.**

### 1. Introduction

https://user-images.githubusercontent.com/7178946/130884531-9f86d536-32b8-43fd-9e4e-17ed316658f1.mov

### 2. Visualizing Results

https://user-images.githubusercontent.com/7178946/130884536-cda8fb91-4c7a-4089-82b6-a61b7371ac65.mov

### 3. Joining

https://user-images.githubusercontent.com/7178946/130884543-8cd4e8ba-116c-441e-b968-c62588e395c3.mov

### 4. Aggregating Subqueries

https://user-images.githubusercontent.com/7178946/130885321-ba141168-2a50-423a-bf09-5a6a03ec57d8.mov

### 5. Creating a Dashboard

https://user-images.githubusercontent.com/7178946/130885327-2866baae-e77c-4dc4-ab63-25cfff9f19c6.mov

### 6. Custom Dimensions

https://user-images.githubusercontent.com/7178946/130884897-f2bb7f16-1c4f-4a4c-bf04-03849385c8fb.mov

### 7. JSON Renderer

https://user-images.githubusercontent.com/7178946/130884900-aad27a77-4b82-4856-8000-37f0b8410018.mov
