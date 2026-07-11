import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

export async function runMigrations(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for migrations");
  const sql = postgres(databaseUrl, { max: 1 });
  const migrationsDirectory = new URL("../migrations/", import.meta.url);
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort((left, right) => left.localeCompare(right));

    for (const file of files) {
      const [applied] = await sql<{ name: string }[]>`
        SELECT name FROM schema_migrations WHERE name = ${file}
      `;
      if (applied) continue;
      const migration = await readFile(new URL(file, migrationsDirectory), "utf8");
      await sql.begin(async (transaction) => {
        await transaction.unsafe(migration);
        await transaction`INSERT INTO schema_migrations (name) VALUES (${file})`;
      });
    }
  } finally {
    await sql.end();
  }
  console.info("ASOpulse database migration complete");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runMigrations();
}
