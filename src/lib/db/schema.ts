import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
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

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    stripeCustomerId: text("stripe_customer_id"),
    role: userRoleEnum("role").notNull().default("user"),
    /** Founders Pack: verified sign-in on/before 09.11.2026 23:59:59 Berlin. Null = not a Founder. */
    founderAt: timestamp("founder_at", { withTimezone: true, mode: "date" }),
    /** 1-based Founder seat number (unique; capped by FOUNDER_SEAT_LIMIT). */
    founderSeat: integer("founder_seat"),
    /** Founders Test Crew opt-in (early access / beta feedback). */
    testCrewOptIn: boolean("test_crew_opt_in").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_email_unique")
      .on(table.email)
      .where(sql`${table.email} is not null`),
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
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

/** Idempotent Stripe webhook event ledger - no payment payload stored. */
export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stripeEventId: text("stripe_event_id").notNull(),
    eventType: text("event_type").notNull(),
    status: stripeWebhookEventStatusEnum("status").notNull().default("processing"),
    errorMessage: text("error_message"),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("stripe_webhook_events_stripe_event_id_unique").on(table.stripeEventId)],
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
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

/** User-owned entitlement / profile grants — clients read only; server writers only. */
export const entitlementGrantKindEnum = pgEnum("entitlement_grant_kind", [
  "purchased_profile",
  "grandfathered_profile",
  "reward_profile",
  "reward_entitlement",
  "admin_profile",
  "admin_entitlement",
  "promo_profile",
  "promo_entitlement",
]);

export const entitlementGrants = pgTable(
  "entitlement_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: entitlementGrantKindEnum("kind").notNull(),
    profileId: text("profile_id"),
    entitlement: text("entitlement"),
    /** UTC; null = permanent. */
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    source: text("source"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("entitlement_grants_user_profile_kind_unique")
      .on(table.userId, table.kind, table.profileId)
      .where(sql`${table.profileId} is not null`),
    uniqueIndex("entitlement_grants_user_entitlement_kind_unique")
      .on(table.userId, table.kind, table.entitlement)
      .where(sql`${table.entitlement} is not null`),
  ],
);

/** Anonymous install ids (elc-…) linked to a signed-in account. */
export const accountDevices = pgTable("account_devices", {
  installId: text("install_id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  linkedAt: timestamp("linked_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const promoCodes = pgTable("promo_codes", {
  code: text("code").primaryKey(),
  profileIds: text("profile_ids")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  drivePlusDays: integer("drive_plus_days"),
  /** Days the profile grants last; null = permanent. */
  grantDays: integer("grant_days"),
  maxRedemptions: integer("max_redemptions"),
  redemptions: integer("redemptions").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  active: boolean("active").notNull().default(true),
  note: text("note"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const promoRedemptions = pgTable(
  "promo_redemptions",
  {
    code: text("code")
      .notNull()
      .references(() => promoCodes.code, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.code, table.userId] })],
);

export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  dynamicDriveTrials: many(dynamicDriveTrials),
  dynamicDriveTrialSessions: many(dynamicDriveTrialSessions),
  entitlementGrants: many(entitlementGrants),
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
export type EntitlementGrantRow = typeof entitlementGrants.$inferSelect;
export type EntitlementGrantInsert = typeof entitlementGrants.$inferInsert;

export const entitlementGrantsRelations = relations(entitlementGrants, ({ one }) => ({
  user: one(users, {
    fields: [entitlementGrants.userId],
    references: [users.id],
  }),
}));

/** Prompt 12 — Sound Spin campaigns / claims (server writers only). */
export const rewardFulfilmentStatusEnum = pgEnum("reward_fulfilment_status", [
  "pending",
  "fulfilled",
  "failed",
  "disabled",
]);

export const rewardOutcomeKindEnum = pgEnum("reward_outcome_kind", [
  "sound_48h",
  "sound_pack_7d",
  "cockpit_theme",
  "one_payment_discount",
  "full_library_weekend",
]);

export const rewardAudienceEnum = pgEnum("reward_audience", ["free", "paid"]);

export const discountReservationStatusEnum = pgEnum("discount_reservation_status", [
  "reserved",
  "applied",
  "consumed",
  "expired",
  "pending",
  "ineligible",
  "failed",
]);

export const rewardCampaigns = pgTable("reward_campaigns", {
  campaignId: text("campaign_id").primaryKey(),
  configVersion: integer("config_version").notNull(),
  title: text("title").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  stagingIllustrativeOnly: boolean("staging_illustrative_only").notNull().default(true),
  periodStrategy: text("period_strategy").notNull().default("utc_calendar_month"),
  configJson: jsonb("config_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const rewardClaims = pgTable(
  "reward_claims",
  {
    claimId: uuid("claim_id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => rewardCampaigns.campaignId, { onDelete: "restrict" }),
    configVersion: integer("config_version").notNull(),
    periodKey: text("period_key").notNull(),
    audience: rewardAudienceEnum("audience").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: rewardFulfilmentStatusEnum("status").notNull().default("pending"),
    outcomeKind: rewardOutcomeKindEnum("outcome_kind").notNull(),
    outcomeRewardId: text("outcome_reward_id").notNull(),
    outcomeJson: jsonb("outcome_json").notNull(),
    fulfilmentAttempts: integer("fulfilment_attempts").notNull().default(0),
    lastFulfilmentError: text("last_fulfilment_error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("reward_claims_user_campaign_period_unique").on(
      table.userId,
      table.campaignId,
      table.periodKey,
    ),
    uniqueIndex("reward_claims_user_campaign_period_idem_unique").on(
      table.userId,
      table.campaignId,
      table.periodKey,
      table.idempotencyKey,
    ),
  ],
);

export const rewardDiscountReservations = pgTable(
  "reward_discount_reservations",
  {
    reservationId: uuid("reservation_id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => rewardClaims.claimId, { onDelete: "cascade" }),
    discountPercent: integer("discount_percent").notNull(),
    status: discountReservationStatusEnum("status").notNull().default("reserved"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    discountCase: text("discount_case"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeCouponId: text("stripe_coupon_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeInvoiceId: text("stripe_invoice_id"),
    stripeDiscountId: text("stripe_discount_id"),
    applyIdempotencyKey: text("apply_idempotency_key"),
    lastError: text("last_error"),
    ineligibleReason: text("ineligible_reason"),
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" }),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    expectedSubtotalCents: integer("expected_subtotal_cents"),
    expectedDiscountAmountCents: integer("expected_discount_amount_cents"),
    expectedInvoiceTotalCents: integer("expected_invoice_total_cents"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("reward_discount_reservations_claim_unique").on(table.claimId),
    uniqueIndex("reward_discount_reservations_apply_idem_unique")
      .on(table.applyIdempotencyKey)
      .where(sql`${table.applyIdempotencyKey} is not null`),
  ],
);

export const rewardCockpitThemes = pgTable(
  "reward_cockpit_themes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    themeId: text("theme_id").notNull(),
    claimId: uuid("claim_id"),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.themeId] })],
);

export type RewardClaimRow = typeof rewardClaims.$inferSelect;
export type RewardDiscountReservationRow = typeof rewardDiscountReservations.$inferSelect;

/** Durable account sessions (hash of the opaque session token, never the raw token). */
export const accountSessions = pgTable(
  "account_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [index("account_sessions_user_id_idx").on(table.userId)],
);

/** Append-only log of admin actions. */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: text("admin_user_id").notNull(),
    adminEmail: text("admin_email").notNull(),
    action: text("action").notNull(),
    target: text("target"),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("admin_audit_log_at_idx").on(table.at)],
);

export type AccountSessionRow = typeof accountSessions.$inferSelect;
export type AdminAuditLogRow = typeof adminAuditLog.$inferSelect;

/** Smiles per Mile cards per account (image rendered on demand from `result`). */
export const smilesCards = pgTable(
  "smiles_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    journeyId: text("journey_id").notNull(),
    profileId: text("profile_id").notNull(),
    profileName: text("profile_name").notNull(),
    score: integer("score").notNull(),
    distanceKm: real("distance_km").notNull(),
    result: jsonb("result").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("smiles_cards_user_journey_uq").on(table.userId, table.journeyId),
    index("smiles_cards_user_created_idx").on(table.userId, table.createdAt),
  ],
);
