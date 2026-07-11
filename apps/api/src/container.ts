import { runMigrations } from "@asopulse/db";

await runMigrations();
await import("./server.js");
