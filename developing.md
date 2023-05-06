## Building Malloy

Building the Malloy repo requires [node.js](https://nodejs.org/en/download/) and a [Java Runtime Environment](https://www.oracle.com/java/technologies/javase-jre8-downloads.html) (JRE 1.6 or higher, 1.8 recommended) installed on your system in order to build the Malloy project.

Alternatively, you can use [nix](https://nixos.org/) to install these dependencies. To use nix, install it with `curl -L https://nixos.org/nix/install | sh` and then run `nix-shell` from the `malloy/` directory. Nix is what _CI_ uses to run builds.

If you want a _smoother_ development experience consider installing [direnv](https://direnv.net/). You need only `cd` into the directory and all the packages will be loaded automatically into your shell.
No need to write `nix-shell` yourself anymore and you can stay in your shell of choice (i.e. zsh).

The following will install dependencies for the entire set of packages and compile the Malloy language and associated packages.

```bash
npm install
npm run build
```

Use the [VS Code ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) for code formatting, or run `npm run lint --fix`.

The tests can be run via the [VS Code Jest Runner extension](https://marketplace.visualstudio.com/items?itemName=firsttris.vscode-jest-runner). Alternatively, use `npm run test`, or a specific file, like `npm run test test/nomodel.spec.ts`.

Some of the Postgres tests depend on static tables (i.e. `test/src/nomodel.spec.ts`). To set up the database locally for these tests, you can `gunzip` the `test/data/postgres/malloytest-postgres.sql.gz` file and run its SQL with a command such as `psql -f test/data/postgres/malloytest-postgres.sql.gz`.

### VS Code tips

We provide a task in VS Code (.vscode/tasks.json) to watch the entire Malloy repo for typscript changes - this allows VS Code to output typescript errors even when files are closed. The default behavior is for errors to only appear in open files. If you want the watcher task to compile all files in the background, you can either run the task manually (Command Palette -> Tasks -> Run Task -> tsc-compile-watch). If you want to enable this task to always start when you open the project, run Command Palette -> Tasks: Manage Automatic Tasks in Folder -> Allow Automatic Tasks in folder.

## Running Tests

See `test/README.md` for infomration about running tests.

## Malloy VSCode Extension

The Malloy VSCode extension's source is now in the [malloy-vscode-extension](https://github.com/malloydata/malloy-vscode-extension) repository.

## Nix

### Updating Nixpkgs

Many of the dependencies (or all) are hydrated via [Nix](https://nixos.org), specifically [nixpkgs](https://github.com/NixOS/nixpkgs).
You can see the version of nixpkgs in use by going to [./nix/sources.json](./nix/sources.json).

```console
> niv update nixpkgs -b <release branch>
```