# Connect a Database

Currently, BigQuery and PostgreSQL are supported.

1. Click on the Malloy icon on the left side of VS Code. This opens the Malloy view - a view that allows you to view schemas as you work with Malloy models and edit database connections.

2. In the "CONNECTIONS" panel, select "Edit Connections". This opens the connection manager page.

3. Click "Add Connection" and fill out the relevant details. See below for database-specific instructions.

4. Press "Test" on the connection to confirm that you have successfully connected to the database

5. Hit "Save," then dive into writing Malloy!


## BigQuery

Authenticating to BigQuery can be done either via OAuth (using your Google Cloud Account) or with a Service Account Key downloaded from Google Cloud

### Option 1: OAuth

To access BigQuery with the Malloy Plugin, you will need to have BigQuery credentials available, and the [gcloud CLI](https://cloud.google.com/sdk/gcloud) installed. Once it's installed, open a terminal and type the following:

```
gcloud auth login --update-adc
gcloud config set project {my_project_id} --installation
```

_Replace `{my_project_id}` with the **ID** of the BigQuery project you want to use & bill to. If you're not sure what this ID is, open Cloud Console, and click on the dropdown at the top (just to the right of the "Google Cloud Platform" text) to view projects you have access to. If you don't already have a project, [create one](https://cloud.google.com/resource-manager/docs/creating-managing-projects)._

### Option 2: Service Account

Add the relevant account information to the new connection, and include the path to the [service account key](https://cloud.google.com/iam/docs/creating-managing-service-account-keys).

## PostgreSQL _(in progress)_
_(Development in progress, date/time support is currently incomplete)_

Add the relevant database connection information. Once you click save, the password (if you have entered one) will be stored in your system keychain.