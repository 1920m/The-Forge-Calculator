import "server-only";
import { after } from "next/server";
import { getCatalogue } from "@/lib/data/catalogue";
import { dbAuthorizer } from "./auth";
import type { Endpoint } from "./endpoints";

/** The real wiring: the database key store, Next's after() for the usage log, and the site's catalogue loader. */
export const liveDeps: Endpoint = {
  authorizer: dbAuthorizer,
  schedule: (task) => after(task),
  now: () => performance.now(),
  catalogue: getCatalogue,
};
