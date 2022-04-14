/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */

/*
 * This script produces a CSV useful for evaluating licenses for third-party software incuded in a binary.
 * It requires one argument, the filename of the CSV. It outputs a CSV with columns described in `outputRow` interface
 */

import { execSync } from "child_process";
import axios from "axios";
import https from "https";
import fs from "fs";
import stringify from "csv-stringify";

interface outputRow {
  name: string;
  licenseLink: string;
  licenseName: string;
  binaryName: string;
  copyrightIncluded: string;
  sourceCodeIncluded: string;
  hasNoticeFile: string;
}

const outputFile = process.argv[2];
if (!outputFile) throw new Error("Output file required as argument");
if (fs.existsSync(outputFile)) throw new Error("Output file exists already");

axios.defaults.timeout = 500000;
axios.defaults.httpsAgent = new https.Agent({ keepAlive: true });

const malloyPackages = [
  "@malloydata/malloy",
  "@malloydata/render",
  "malloy-vscode",
  "@malloydata/db-test",
  "@malloydata/db-bigquery",
  "@malloydata/db-postgres",
];

// licenses that we would need to mirror source for, if we included (we don't today)
const sourceMirrorLicenses = [
  "CDDL-1.0",
  "CDDL-1.1",
  "CECILL-C",
  "CPL-1.0",
  "EPL-1.0",
  "EPL-2.0",
  "IPL-1.0",
  "MPL-1.0",
  "MPL-1.1",
  "MPL-2.0",
  "APSL-1.0",
  "APSL-1.1",
  "APSL-1.2",
  "APSL-2.0",
  "Ruby",
];

// packages that don't provide license files in standard places
const licenseFoundElsewhere: { [id ? string] ? string } = {
  "agent-base":
    "https://github.com/TooTallNate/node-agent-base/blob/master/README.md",
  crypt: "https://github.com/pvorb/node-crypt/blob/master/LICENSE.mkd",
  "http-proxy-agent": "https://github.com/TooTallNate/node-http-proxy-agent",
  "https-proxy-agent": "https://github.com/TooTallNate/node-https-proxy-agent",
};

const packagesWithoutLocationsSpecified: { [id: string]: string } = {};

const getLicenses = async () => {
  const out: outputRow[] = [];
  const errors: [string, Error][] = [];

  // dependencyList.data.head is [ 'Name', 'Version', 'License', 'URL', 'VendorUrl', 'VendorName' ]
  const dependencyList = JSON.parse(
    execSync("yarn --prod true --no-progress licenses list --json").toString()
  );

  // if specific versions are required they might be duped in list - de-deup here
  const dedupedDependencies = dependencyList.data.body.filter(
    (arr: any, index: any, self: any) =>
      self.findIndex((t: any) => t[0] == arr[0]) === index
  );

  for (const dependency of dedupedDependencies) {
    // don't list our own packages
    if (malloyPackages.includes(dependency[0])) continue;
    // ignore top-level workspace
    if (dependency[0].startsWith("workspace-aggregator")) continue;

    const name = dependency[0] as string;

    const row: Partial<outputRow> = {
      name,
      binaryName: "Malloy VSCode Extension",
      licenseName: dependency[2],
    };

    const url = dependency[3];

    if (Object.keys(licenseFoundElsewhere).includes(name)) {
      row.licenseLink = licenseFoundElsewhere[name];
    } else {
      // attempt to get license link using packages url to repo
      // some formats:
      //  git+https://github.com/...
      //  git://github.com/....
      //  git@github.com:.....git
      //  git+ssh://git@github.com...
      //  https://github.com/...

      let httpURL: string;
      if (url.startsWith("git+https://")) {
        httpURL = url.replace("git+", "");
      } else if (url.startsWith("git://")) {
        httpURL = url.replace("git", "https");
      } else if (url.startsWith("git@")) {
        httpURL = url.replace("git@", "https://");
      } else if (url.startsWith("git+ssh://git@")) {
        httpURL = url.replace("git+ssh://git@", "https://");
      } else {
        httpURL = url.replace("http://", "https://");
      }

      // deal with git URLs
      if (httpURL.endsWith(".git")) {
        httpURL = httpURL.slice(0, -4);
      }
      if (httpURL.indexOf(":", 6) != -1) {
        const index = httpURL.indexOf(":", 6);
        httpURL = httpURL.substr(0, index) + "/" + httpURL.substr(index + 1);
      }

      // filenames roughly ordered by occurence so we search faster
      const licenseFileNames = [
        "LICENSE",
        "License",
        "LICENCE",
        "LICENSE-MIT",
        "license",
      ];
      const licenseExtensions = ["", ".md", ".txt"];
      const defaultBranchNames = ["blob/main/", "blob/master/", ""]; // "" is because some sub-packages already have branch name embedded in package URL

      // some packages don't include a url
      if (
        httpURL == "Unknown" &&
        Object.keys(packagesWithoutLocationsSpecified).includes(name)
      ) {
        httpURL = packagesWithoutLocationsSpecified[name];
      }

      if (httpURL == "Unknown") {
        row.licenseLink = "TODO";
      } else {
        console.log(`searching for ${row.name} at ${httpURL}`);

        outer: for (const fileName of licenseFileNames) {
          for (const branch of defaultBranchNames) {
            for (const extension of licenseExtensions) {
              const licenseLink = `${httpURL}/${branch}${fileName}${extension}`;

              try {
                // stop GH/etc from limiting us
                await new Promise((resolve) => setTimeout(resolve, 400));

                const license = await axios.head(licenseLink);
                if (license) {
                  row.licenseLink = licenseLink;
                  break outer;
                }
              } catch (e) {
                if (axios.isAxiosError(e)) {
                  if (!e.response || e.response.status != 404) {
                    console.warn("ERROR: " + e.message);
                    errors.push([name, e]);
                  }
                } else throw e;
              }
            }
          }
        }
      }

      if (!row.licenseLink) {
        console.warn("WARN: could not find license for " + httpURL);
        row.licenseLink = "TODO";
      }
    }

    row.copyrightIncluded = "true"; // we include copyright via yarn licenses generate-disclaimer

    // if we happened to add a lib with a mirror-required license, mark a TODO
    if (sourceMirrorLicenses.includes(row.licenseName as string)) {
      row.sourceCodeIncluded = "TODO";
    } else row.sourceCodeIncluded = "false";

    out.push(row as outputRow);
  }

  stringify(
    out,
    {
      columns: [
        "name",
        "licenseLink",
        "licenseName",
        "binaryName",
        "copyrightIncluded",
        "sourceCodeIncluded",
      ],
    },
    (err: any, output: string) => {
      fs.writeFileSync(outputFile, output);
    }
  );

  if (errors.length > 0) {
    for (const e of errors) {
      console.log(e);
    }
    console.log(
      "Finished with errors. There may still be TODOs - search for 'TODO' in the output"
    );
  } else {
    console.log(
      "Finished successfully. There may still be TODOs - search for 'TODO' in the output"
    );
  }
};

getLicenses();
