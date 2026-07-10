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
});

const queue = new Queue<ObservationJob, unknown, string>(OBSERVATION_QUEUE, { connection });

function schedulePattern(settings: {
  frequency: "daily" | "weekdays" | "weekly";
  time: string;
  weekday: number;
}) {
  const [hour = "6", minute = "0"] = settings.time.split(":");
  if (settings.frequency === "weekdays") return `${Number(minute)} ${Number(hour)} * * 1-5`;
  if (settings.frequency === "weekly") {
    return `${Number(minute)} ${Number(hour)} * * ${settings.weekday === 7 ? 0 : settings.weekday}`;
  }
  return `${Number(minute)} ${Number(hour)} * * *`;
}

for (const project of await workspace.listScheduledProjects()) {
  await queue.upsertJobScheduler(
    `project:${project.id}`,
    { pattern: schedulePattern(project.settings), tz: project.settings.timezone },
    {
      name: "observe-project",
      data: { projectId: project.id, trigger: "scheduled" },
      opts: {
        attempts: 4,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 250,
      },
    },
  );
}

const worker = new Worker<ObservationJob, { projectId: string; observedAt: string }>(
  OBSERVATION_QUEUE,
  async (job) => {
    const jobRun = job.data.runId
      ? { id: job.data.runId }
      : await workspace.createSystemObservationRun(
          job.data.projectId,
          job.data.trigger === "initial" ? "initial" : "scheduled",
          job.data.trackedKeywordIds,
        );
    try {
      await workspace.startObservationRun(jobRun.id);
      const result = await workspace.observeProject(job.data.projectId, job.data.trackedKeywordIds);
      await workspace.finishObservationRun(jobRun.id, result);
      return { projectId: job.data.projectId, observedAt: result.observedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown observation failure";
      await workspace.finishObservationRun(jobRun.id, {
        observedKeywords: 0,
        generatedSignals: 0,
        failedKeywords: [{ keyword: "project", message }],
        observedAt: new Date().toISOString(),
      });
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
