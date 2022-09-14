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

import express from "express";
import { routes } from "./routes";
import cors from "cors";
import * as path from "path";

const app = express();

const DEV = process.env.DEV === "1";

const allowedOrigins = [];

if (DEV) {
  allowedOrigins.push("http://localhost:3000");
}

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const router = express.Router();

routes(router);

app.use("/api", router);

const BUILD_ROOT = path.join(__dirname, "../../build");

app.use("/static", express.static(path.join(BUILD_ROOT, "/app")));

app.use("/fonts", express.static(path.join(BUILD_ROOT, "/app/fonts")));

// app.use("/", async (req: express.Request, res: express.Response) => {
//   const indexFile = await fs.readFile(
//     path.join(BUILD_ROOT, "/app/index.html"),
//     "utf8"
//   );

//   console.log(JSON.stringify(req.path, null, 2));

//   const nonce = (req as never as { nonce: string }).nonce;

//   console.log(JSON.stringify(nonce));

//   // TODO crs move these hacks into a webpack configuration...
//   const modifiedIndex = indexFile
//     // ... webpack should provide a nonce template string, which we fill in
//     .replace(/<script/g, `<script nonce="${nonce}"`)
//     // ... webpack should have a static root set so that these are not relative
//     .replace(/href="\.\/static\//g, 'href="/static/')
//     .replace(/src="\.\/static\//g, 'src="/static/');

//   res.send(modifiedIndex);
// });

app.use("/", express.static(path.join(BUILD_ROOT, "/app")));

const PORT = 4000;
const HOST = "localhost";

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running at http://${HOST}:${PORT}`);
});
