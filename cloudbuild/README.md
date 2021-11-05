# Cloudbuild CI

## What is Cloudbuild?

Cloudbuild is a GCP solution for running tests and other continuous integration tasks in the cloud

## Our Testing Architecture

There are several technologies to be aware of:
* **cloudbuild**: infrastructure to run tests; automatically provisions machines, communicates with GitHub (i.e. updates PRs with status), and furnishes UX for viewing test results
* **docker**: cloudbuild runs test scripts inside a _docker image_
* **nix**: a technology that provides furnishes an environment with binaries; it can be thought of like `apt-get`, but allows for isolated "virtual" environments that set `$PATH` to binaries managed by nix

The way that we run tests:
* we have a `cloudbuild.yaml` file that specifies the build -- see `cloudbuild/build-test/cloudbuild.yaml`
* the build runs the `nixos/nix` docker image -- this ensures that `nix` is installed
* we run the file `cloudbuild/build-test/build-test.sh` -- this _enters_ into a nix environment and runs `yarn build`, etc. 

### Our Testing Architecture: Cloudbuild

#### Our Testing Architecture: Cloudbuild: Adding Checks

Navigate to the Google Cloud console, go to the triggers section. If you are a maintainer, you will have access to this infrastructure.

### Our Testing Architecture: Nix: Adding dependencies in nix

### Our Testing Architecture: Nix: Adding dependencies

Here, a dependency means something like yarn or bash or node.

If you need to add a dependency, see `default.nix`. `buildInputs = [ ... ]` is a list of dependencies. One can search for the names of available dependencies at [https://search.nixos.org/packages](https://search.nixos.org/packages).

## Our Testing Architecture: Future Directions

## Our Testing Architecture: Future Directions: Custom Docker Image

You will notice that when a build runs, nix dependencies are installed.

These both take a meaningful amount of time. We can reduce the amount of time this takes by creating a docker image based on `nixos/nix`, which pre-installs nix dependencies. 

## Our Testing Architecture: Future Directions: Pinning Nix Dependencies

We can pin nix dependencies; `.envrc with NIX_PATH set to a stable channel URL` (via nix-users Google-internal gChat channel).

## Debugging test failures on CI

One can install nix locally for themselves by using the instructions at [https://nixos.org/download.html](https://nixos.org/download.html). Note that this script is not well supported on MacOS (your mileage may vary) and on systems with one root user. In most Linux setups, it will just work. 

Once nix is installed, `cd` into the `malloy` repo, run `nix-shell --pure` and then run your commands (e.g. `yarn test`).

This will ensure a similar environment to CI.
