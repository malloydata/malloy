# Welcome to Malloy

Malloy is an experimental language for describing data relationships and transformations. It is both a semantic modeling language and a querying language. Malloy is not an officially supported Google product.

- Queries compile to SQL - Malloy writes SQL optimized for your database
- Computations are modular, composable, reusable, and extendable in ways that are consistent with modern programming paradigms.
- Data is interpreted as a network of relationships, and generates network graphs with results, so Malloy can ensure correctness of aggregate computations through multiple levels of transformation.
- Defaults are smart, and Malloy is concise (where SQL is verbose and often redundant).
- Currently available on BigQuery and Postgres.

Malloy is for anyone who works with SQL--whether you’re an analyst, data scientist, data engineer, or someone building a data application. If you know SQL, Malloy will feel familiar, while more powerful and efficient.

# Get the Plugin

Want to experiment with Malloy? Great! Download the VS Code Plugin for writing and running models, queries, and transformations.

1. VSCode
2. Download the plugin
3. Connect your database (Postgres or BigQuery)

# Join the Community

- Join the [**Malloy Slack Community!**](https://join.slack.com/t/malloy-community/shared_invite/zt-upi18gic-W2saeFu~VfaVM1~HIerJ7w) Use this community to ask questions, meet other Malloy users, and share ideas with one another.
- Use [**GitHub issues**](https://github.com/looker-open-source/malloy/issues) in this Repo to provide feedback, suggest improvements, report bugs, and start new discussions.

# Documentation

[Full documentation for Malloy](https://looker-open-source.github.io/malloy/)

- [eCommerce Example Analysis](https://looker-open-source.github.io/malloy/documentation/examples/ecommerce.html) - a walkthrough of basics on an ecommerce dataset
- [Basics](https://looker-open-source.github.io/malloy/documentation/language/basic.html) - docs introduction to the language
- [Flights Example Analysis](https://looker-open-source.github.io/malloy/documentation/examples/faa.html) - examples built on the NTSB flights public dataset
- [Modeling Walkthrough](https://looker-open-source.github.io/malloy/documentation/examples/iowa/iowa.html) - introduction to modeling via the Iowa liquor sales public data set

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
yarn build-extension
```

## Malloy VSCode Extension

The Malloy VSCode extension's source is in the `malloy-vscode` directory.

### Installation

To build and install the current version of the extension, first ensure that you've followed the steps to install the dependencies for the Malloy Repo. **Note: You will need to re-run the below any time you pull in new changes.** Then run:

```bash
yarn build-extension
```

Next, in VSCode _EITHER_:

1. Run the "Extensions: Install from VSIX" command (CTRL/CMD + SHIFT + P opens the command interface), then select `/malloy/packages/malloy-vscode/malloy-vscode-x.x.x.vsix`

_OR_

2. Open the `malloy-vscode` package root directory in VSCode, right click on `malloy-vscode-x.x.x.vsix` and select "Install Extension VSIX".

### Contributing

If you would like to [work on Malloy](CONTRIBUTING.md), you can find some helpful instructions about [developing Malloy](developing.md) and [developing documentation](documentation.md).
