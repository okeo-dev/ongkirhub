import { serve } from "@hono/node-server";
import { createApp, loadEnv } from "./lib.js";

const env = loadEnv();
const app = createApp({ env });

serve(
  {
    fetch: app.fetch,
    port: env.port,
    hostname: env.host,
  },
  (info) => {
    console.log(
      `OngkirHub API listening on http://${info.address}:${info.port}`,
    );
  },
);
