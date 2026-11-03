import { assertExposedServerSessionSecret, buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 4100);

try {
  assertExposedServerSessionSecret();
  const app = buildApp();
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  console.error(error instanceof Error ? error.message : "API failed to start");
  process.exitCode = 1;
}
