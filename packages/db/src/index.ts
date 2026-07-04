import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDatabase(url: string) {
  const client = postgres(url, { max: 10 });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}

export * from "./schema.js";
