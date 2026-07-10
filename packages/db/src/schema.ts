import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    appId: text("app_id").notNull(),
    appName: text("app_name").notNull(),
    storefront: text("storefront").notNull().default("US"),
    iconUrl: text("icon_url").notNull().default(""),
    scheduleEnabled: boolean("schedule_enabled").notNull().default(true),
    scheduleFrequency: text("schedule_frequency").notNull().default("daily"),
    scheduleTime: text("schedule_time").notNull().default("06:00"),
    scheduleTimezone: text("schedule_timezone").notNull().default("UTC"),
    scheduleWeekday: integer("schedule_weekday").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("projects_owner_app_storefront").on(table.ownerId, table.appId, table.storefront),
  ],
);
export const trackedKeywords = pgTable(
  "tracked_keywords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tracked_project_keyword").on(table.projectId, table.keyword)],
);
export const rankObservations = pgTable(
  "rank_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackedKeywordId: uuid("tracked_keyword_id")
      .notNull()
      .references(() => trackedKeywords.id, { onDelete: "cascade" }),
    rank: integer("rank"),
    resultCount: integer("result_count").notNull(),
    competition: integer("competition").notNull(),
    opportunity: integer("opportunity").notNull(),
    methodVersion: text("method_version").notNull(),
    confidence: text("confidence").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("rank_observations_keyword_time").on(table.trackedKeywordId, table.observedAt)],
);
export const signals = pgTable("signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  trackedKeywordId: uuid("tracked_keyword_id").references(() => trackedKeywords.id, {
    onDelete: "cascade",
  }),
  kind: text("kind").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const jobRuns = pgTable("job_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobName: text("job_name").notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  trigger: text("trigger").notNull().default("scheduled"),
  status: text("status").notNull(),
  detail: text("detail"),
  requestedCount: integer("requested_count").notNull().default(0),
  observedCount: integer("observed_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  failures: jsonb("failures")
    .$type<Array<{ keyword: string; message: string }>>()
    .notNull()
    .default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});
