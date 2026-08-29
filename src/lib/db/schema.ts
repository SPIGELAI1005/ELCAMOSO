import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { Plan } from "@/lib/entitlements/types";

export const billingStatusEnum = pgEnum("billing_status", [
  "free",
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
]);

export const subscriptionProviderEnum = pgEnum("subscription_provider", ["stripe"]);

export const billingPlanEnum = pgEnum("billing_plan", ["FREE", "DRIVE_PLUS"]);

export const billingIntervalEnum = pgEnum("billing_interval", ["month", "year"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    stripeCustomerId: text("stripe_customer_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email).where(sql`${table.email} is not null`),
    uniqueIndex("users_stripe_customer_id_unique")
      .on(table.stripeCustomerId)
      .where(sql`${table.stripeCustomerId} is not null`),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: subscriptionProviderEnum("provider").notNull(),
    providerCustomerId: text("provider_customer_id").notNull(),
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    plan: billingPlanEnum("plan").notNull().$type<Plan>(),
    interval: billingIntervalEnum("interval"),
    status: billingStatusEnum("status").notNull().default("free"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
      mode: "date",
    }),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
      mode: "date",
    }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("subscriptions_provider_subscription_unique").on(
      table.provider,
      table.providerSubscriptionId,
    ),
  ],
);

export const stripeWebhookEventStatusEnum = pgEnum("stripe_webhook_event_status", [
  "processing",
  "succeeded",
  "failed",
]);

/** Idempotent Stripe webhook event ledger — no payment payload stored. */
export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stripeEventId: text("stripe_event_id").notNull(),
    eventType: text("event_type").notNull(),
    status: stripeWebhookEventStatusEnum("status").notNull().default("processing"),
    errorMessage: text("error_message"),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("stripe_webhook_events_stripe_event_id_unique").on(table.stripeEventId),
  ],
);

export const dynamicDriveTrialStatusEnum = pgEnum("dynamic_drive_trial_status", [
  "available",
  "active",
  "exhausted",
  "expired",
  "converted",
]);

export const dynamicDriveTrialSessionStatusEnum = pgEnum("dynamic_drive_trial_session_status", [
  "active",
  "ended",
]);

export const dynamicDriveTrials = pgTable(
  "dynamic_drive_trials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    allocatedSeconds: integer("allocated_seconds").notNull().default(1800),
    usedSeconds: integer("used_seconds").notNull().default(0),
    allocatedSessions: integer("allocated_sessions").notNull().default(3),
    usedSessions: integer("used_sessions").notNull().default(0),
    status: dynamicDriveTrialStatusEnum("status").notNull().default("available"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("dynamic_drive_trials_user_unique").on(table.userId)],
);

export const dynamicDriveTrialSessions = pgTable(
  "dynamic_drive_trial_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trialId: uuid("trial_id")
      .notNull()
      .references(() => dynamicDriveTrials.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    driveSessionId: text("drive_session_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true, mode: "date" }).notNull(),
    lastCreditedAt: timestamp("last_credited_at", { withTimezone: true, mode: "date" }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    creditedSeconds: integer("credited_seconds").notNull().default(0),
    status: dynamicDriveTrialSessionStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("dynamic_drive_trial_sessions_drive_unique").on(
      table.trialId,
      table.driveSessionId,
    ),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  dynamicDriveTrials: many(dynamicDriveTrials),
  dynamicDriveTrialSessions: many(dynamicDriveTrialSessions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const dynamicDriveTrialsRelations = relations(dynamicDriveTrials, ({ one, many }) => ({
  user: one(users, {
    fields: [dynamicDriveTrials.userId],
    references: [users.id],
  }),
  sessions: many(dynamicDriveTrialSessions),
}));

export const dynamicDriveTrialSessionsRelations = relations(
  dynamicDriveTrialSessions,
  ({ one }) => ({
    trial: one(dynamicDriveTrials, {
      fields: [dynamicDriveTrialSessions.trialId],
      references: [dynamicDriveTrials.id],
    }),
    user: one(users, {
      fields: [dynamicDriveTrialSessions.userId],
      references: [users.id],
    }),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type SubscriptionInsert = typeof subscriptions.$inferInsert;
export type StripeWebhookEventRow = typeof stripeWebhookEvents.$inferSelect;
export type StripeWebhookEventInsert = typeof stripeWebhookEvents.$inferInsert;
export type DynamicDriveTrialRow = typeof dynamicDriveTrials.$inferSelect;
export type DynamicDriveTrialSessionRow = typeof dynamicDriveTrialSessions.$inferSelect;
