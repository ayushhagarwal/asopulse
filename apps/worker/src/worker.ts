import { createWorkspaceService } from "@asopulse/core";
import { createDatabase } from "@asopulse/db";
import { AppleSearchProvider } from "@asopulse/providers";
import { type ConnectionOptions, Queue, Worker } from "bullmq";
import { OBSERVATION_QUEUE, type ObservationJob } from "./queues.js";

const redisUrlValue = process.env.REDIS_URL;
if (!redisUrlValue) throw new Error("REDIS_URL is required for the worker");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the worker");

const redisUrl = new URL(redisUrlValue);
const connection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  ...(redisUrl.username ? { username: decodeURIComponent(redisUrl.username) } : {}),
  ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}),
};

const database = createDatabase(databaseUrl);
const workspace = createWorkspaceService({
  database: database.db,
  provider: new AppleSearchProvider(),
  ...(process.env.TRACKING_SCHEDULE ? { trackingSchedule: process.env.TRACKING_SCHEDULE } : {}),
});

const queue = new Queue<ObservationJob, unknown, string>(OBSERVATION_QUEUE, { connection });

await queue.upsertJobScheduler(
  "daily-rank-observation",
  { pattern: process.env.TRACKING_SCHEDULE ?? "0 6 * * *" },
  {
    name: "observe-projects",
    data: { projectId: "all" },
    opts: {
      attempts: 4,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 250,
    },
  },
);

const worker = new Worker<ObservationJob, { projectId: string; observedAt: string }>(
  OBSERVATION_QUEUE,
  async (job) => {
    const jobRun = await workspace.createJobRun("daily-rank-observation", `job:${job.id}`);
    try {
      const result =
        job.data.projectId === "all"
          ? await workspace.observeAllProjects()
          : await workspace.observeProject(job.data.projectId);
      await workspace.finishJobRun(
        jobRun.id,
        "completed",
        `${result.observedKeywords} keywords observed, ${result.generatedSignals} signals generated`,
      );
      return { projectId: job.data.projectId, observedAt: result.observedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown observation failure";
      await workspace.finishJobRun(jobRun.id, "failed", message);
      throw error;
    }
  },
  { connection, concurrency: 1, limiter: { max: 19, duration: 60_000 } },
);

worker.on("failed", (job, error) =>
  console.error("Observation failed", { jobId: job?.id, message: error.message }),
);
worker.on("completed", (job) => console.info("Observation completed", { jobId: job.id }));

async function shutdown() {
  await worker.close();
  await queue.close();
  await database.close();
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
