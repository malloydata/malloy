# Connecting a Database in the VSCode Extension
Currently, BigQuery, PostgreSQL _(in progress)_, and DuckDB are supported.  These instructions assume you have already installed the [Malloy extension](https://marketplace.visualstudio.com/items?itemName=malloydata.malloy-vscode) in VSCode.

## Adding the Connection in VS Code
_Note:  DuckDB is natively supported, allowing you to skip these initial steps._

1. Click on the Malloy icon on the left side of VS Code. This opens the Malloy view - a view that allows you to view schemas as you work with Malloy models and edit database connections.

2. In the "CONNECTIONS" panel, select "Edit Connections". This opens the connection manager page.

3. Click "Add Connection" and fill out the relevant details. See below for database-specific instructions.

4. Press "Test" on the connection to confirm that you have successfully connected to the database

5. Hit "Save," then dive into writing Malloy! We recommend starting with one of our Samples, which can be found [here](https://github.com/looker-open-source/malloy/tree/main/samples) or downloaded from the VS Code Plugin

<img width="393" alt="Screen Shot 2022-07-20 at 4 40 21 PM" src="https://user-images.githubusercontent.com/7178946/180100697-1cd6d1bc-4ee3-40c8-a8af-9e95eded3a6c.png">



## BigQuery

Authenticating to BigQuery can be done either via OAuth (using your Google Cloud Account) or with a Service Account Key downloaded from Google Cloud

### Option 1: OAuth

To access BigQuery with the Malloy Plugin, you will need to have a [Google Cloud Account](https://cloud.google.com/), access to BigQuery, and the [gcloud CLI](https://cloud.google.com/sdk/gcloud) installed. Once the gcloud CLI is installed, open a terminal and type the following:

```bash
gcloud auth login --update-adc
gcloud config set project {my_project_id} --installation
```

_Replace `{my_project_id}` with the **ID** of the BigQuery project you want to use & bill to. If you're not sure what this ID is, open Cloud Console, and click on the dropdown at the top (just to the right of the "Google Cloud Platform" text) to view projects you have access to. If you don't already have a project, [create one](https://cloud.google.com/resource-manager/docs/creating-managing-projects)._

When creating the connection in the VS Code Plugin, you can leave the optional fields blank as it will connect using your gcloud project configuration.

### Option 2: Service Account

Add the relevant account information to the new connection, and include the path to the [service account key](https://cloud.google.com/iam/docs/creating-managing-service-account-keys).

## PostgreSQL _(in progress)_
_(Development in progress, date/time support is currently incomplete)_

Add the relevant database connection information. Once you click save, the password (if you have entered one) will be stored in your system keychain.

## DuckDB

DuckDB is available without needing to explicitly configure a connection. It works with local parquet or csv files, which can be referenced in a source. This example has the CSV in the same directory as the .malloy model file: `source: baby_names is table('duckdb:babynames.csv')`

There are a number of examples on public data using DuckDB available [here](https://github.com/lloydtabb/malloy_examples).
