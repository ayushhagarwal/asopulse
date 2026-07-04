import { buildApp } from "./app.js";

const app = buildApp();
const port = Number(process.env.PORT ?? 4100);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
