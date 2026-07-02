import { type ConnectionOptions, Queue, Worker } from "bullmq";
import { OBSERVATION_QUEUE, type ObservationJob } from "./queues";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const connection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  ...(redisUrl.username ? { username: decodeURIComponent(redisUrl.username) } : {}),
  ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}),
};
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
    // The provider request and persistence transaction are deliberately isolated behind the API.
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://api:4100"}/health`);
    if (!response.ok) throw new Error(`API unavailable while processing ${job.name}`);
    return { projectId: job.data.projectId, observedAt: new Date().toISOString() };
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
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
