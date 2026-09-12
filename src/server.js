import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync } from "node:fs";

import { createApp } from "./app.js";
import { config } from "./config/app-config.js";

const requestHandler = createApp(config);
const server =
  config.protocol === "https"
    ? createHttpsServer(
        {
          cert: readFileSync(config.certFile),
          key: readFileSync(config.keyFile)
        },
        requestHandler
      )
    : createHttpServer(requestHandler);

server.listen(config.port, config.host, () => {
  console.log(`Yahoo fantasy basketball app running at ${config.protocol}://${config.host}:${config.port}`);
});
