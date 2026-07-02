import { readFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for migrations");
const sql = postgres(databaseUrl, { max: 1 });
const migration = await readFile(
  new URL("../migrations/0000_initial.sql", import.meta.url),
  "utf8",
);
await sql.unsafe(migration);
await sql.end();
console.info("ASOpulse database migration complete");
