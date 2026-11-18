/**
 * Reviewed, idempotent account merge used by scripts/merge-duplicate-accounts.ts.
 * Default is a dry run. --apply must be passed explicitly. Never run against
 * production from tests; the CLI also refuses a production-looking DATABASE_URL
 * unless --allow-production is set.
 */
import { canonicalAccountEmail, emailLookupAliases } from "@/lib/account/canonical-email";
import { smileLevelWithFloor } from "@/lib/smiles/rewards";

export interface SqlClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
  withTransaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;
}

export interface UserRow {
  id: string;
  email: string | null;
  founderSeat: number | null;
  founderAt: string | null;
  stripeCustomerId: string | null;
  testCrewOptIn: boolean;
  smileTotal: number | null;
  smileHandle: string | null;
  smileRefCode: string | null;
}

export interface MoveCount {
  table: string;
  moved: number;
  skipped: number;
  notes: string[];
}

export interface MergePlan {
  primary: UserRow;
  secondaries: UserRow[];
  moves: MoveCount[];
  conflicts: string[];
  smileTotalAfter: number;
}

export interface DuplicateGroup {
  canonicalEmail: string;
  users: UserRow[];
  founderSeats: number[];
}

function asUser(row: Record<string, unknown>): UserRow {
  return {
    id: String(row["id"]),
    email: (row["email"] as string | null) ?? null,
    founderSeat: row["founder_seat"] == null ? null : Number(row["founder_seat"]),
    founderAt: row["founder_at"] == null ? null : String(row["founder_at"]),
    stripeCustomerId: (row["stripe_customer_id"] as string | null) ?? null,
    testCrewOptIn: Boolean(row["test_crew_opt_in"]),
    smileTotal: row["smile_total"] == null ? null : Number(row["smile_total"]),
    smileHandle: (row["smile_handle"] as string | null) ?? null,
    smileRefCode: (row["smile_ref_code"] as string | null) ?? null,
  };
}

const USER_SELECT = `
  select id::text as id,
         email,
         founder_seat,
         founder_at,
         stripe_customer_id,
         coalesce(test_crew_opt_in, false) as test_crew_opt_in,
         smile_total,
         smile_handle,
         smile_ref_code
    from users
`;

export async function listUsers(db: SqlClient): Promise<UserRow[]> {
  const rows = await db.query(`${USER_SELECT} order by founder_seat nulls last, created_at, id`);
  return rows.map(asUser);
}

export async function findUserBySeat(db: SqlClient, seat: number): Promise<UserRow | null> {
  const rows = await db.query(`${USER_SELECT} where founder_seat = $1`, [seat]);
  return rows[0] ? asUser(rows[0]) : null;
}

export async function findUserById(db: SqlClient, id: string): Promise<UserRow | null> {
  const rows = await db.query(`${USER_SELECT} where id = $1::uuid`, [id]);
  return rows[0] ? asUser(rows[0]) : null;
}

export async function findUsersByCanonicalEmail(db: SqlClient, email: string): Promise<UserRow[]> {
  const aliases = emailLookupAliases(email);
  const placeholders = aliases.map((_, i) => "$" + String(i + 1)).join(", ");
  const rows = await db.query(`${USER_SELECT} where lower(email) in (${placeholders})`, aliases);
  return rows.map(asUser);
}

export async function findDuplicateAccountGroups(db: SqlClient): Promise<DuplicateGroup[]> {
  const users = await listUsers(db);
  const groups = new Map<string, UserRow[]>();
  for (const user of users) {
    if (!user.email) continue;
    const key = canonicalAccountEmail(user.email);
    const list = groups.get(key) ?? [];
    list.push(user);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([canonicalEmail, groupUsers]) => ({
      canonicalEmail,
      users: groupUsers,
      founderSeats: groupUsers
        .map((user) => user.founderSeat)
        .filter((seat): seat is number => seat != null)
        .sort((a, b) => a - b),
    }))
    .filter((group) => group.users.length > 1 || group.founderSeats.length > 1)
    .sort((a, b) => a.canonicalEmail.localeCompare(b.canonicalEmail));
}

async function count(db: SqlClient, text: string, params: unknown[] = []): Promise<number> {
  const rows = await db.query<{ n: number | string }>(text, params);
  return Number(rows[0]?.n ?? 0);
}

async function tableExists(db: SqlClient, name: string): Promise<boolean> {
  const rows = await db.query<{ n: number | string }>(
    `select count(*)::int as n from information_schema.tables
      where table_schema = 'public' and table_name = $1`,
    [name],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

async function collectMoves(
  db: SqlClient,
  primaryId: string,
  secondaryId: string,
): Promise<{ moves: MoveCount[]; smileTotalAfter: number }> {
  const moves: MoveCount[] = [];
  const add = async (
    table: string,
    movedSql: string,
    skippedSql: string,
    params: unknown[],
    notes: string[] = [],
  ) => {
    if (!(await tableExists(db, table))) {
      moves.push({ table, moved: 0, skipped: 0, notes: ["table not present"] });
      return;
    }
    moves.push({
      table,
      moved: await count(db, movedSql, params),
      skipped: skippedSql ? await count(db, skippedSql, params) : 0,
      notes,
    });
  };

  const pair = [primaryId, secondaryId];

  await add(
    "smiles_cards",
    `select count(*)::int as n from smiles_cards s
      where s.user_id = $2
        and not exists (
          select 1 from smiles_cards p
           where p.user_id = $1 and p.journey_id = s.journey_id
        )`,
    `select count(*)::int as n from smiles_cards s
      where s.user_id = $2
        and exists (
          select 1 from smiles_cards p
           where p.user_id = $1 and p.journey_id = s.journey_id
        )`,
    pair,
  );

  await add(
    "smile_ledger",
    `select count(*)::int as n from smile_ledger s
      where s.user_id = $2
        and not exists (
          select 1 from smile_ledger p
           where p.user_id = $1 and p.reason = s.reason
             and p.ref is not distinct from s.ref
        )`,
    `select count(*)::int as n from smile_ledger s
      where s.user_id = $2
        and exists (
          select 1 from smile_ledger p
           where p.user_id = $1 and p.reason = s.reason
             and p.ref is not distinct from s.ref
        )`,
    pair,
  );

  await add(
    "founder_sound_picks",
    `select count(*)::int as n from founder_sound_picks s
      where s.account_id = $2
        and not exists (
          select 1 from founder_sound_picks p
           where p.account_id = $1 and p.sound_id = s.sound_id
        )`,
    `select count(*)::int as n from founder_sound_picks s
      where s.account_id = $2
        and exists (
          select 1 from founder_sound_picks p
           where p.account_id = $1 and p.sound_id = s.sound_id
        )`,
    pair,
  );

  await add(
    "entitlement_grants",
    `select count(*)::int as n from entitlement_grants s
      where s.user_id = $2::uuid
        and not exists (
          select 1 from entitlement_grants p
           where p.user_id = $1::uuid
             and p.kind = s.kind
             and p.profile_id is not distinct from s.profile_id
             and p.entitlement is not distinct from s.entitlement
        )`,
    `select count(*)::int as n from entitlement_grants s
      where s.user_id = $2::uuid
        and exists (
          select 1 from entitlement_grants p
           where p.user_id = $1::uuid
             and p.kind = s.kind
             and p.profile_id is not distinct from s.profile_id
             and p.entitlement is not distinct from s.entitlement
        )`,
    pair,
  );

  const subPrimary = await count(
    db,
    `select count(*)::int as n from subscriptions where user_id = $1::uuid`,
    [primaryId],
  );
  const subSecondary = (await tableExists(db, "subscriptions"))
    ? await count(db, `select count(*)::int as n from subscriptions where user_id = $1::uuid`, [
        secondaryId,
      ])
    : 0;
  const subNotes: string[] = [];
  if (subPrimary > 0 && subSecondary > 0) {
    subNotes.push(
      "Both accounts have subscriptions. Keeping the primary Stripe customer; not moving secondary rows.",
    );
  }
  await add(
    "subscriptions",
    subPrimary > 0
      ? `select 0::int as n where $1::text is not null`
      : `select count(*)::int as n from subscriptions where user_id = $1::uuid`,
    subPrimary > 0
      ? `select count(*)::int as n from subscriptions where user_id = $1::uuid`
      : `select 0::int as n where $1::text is not null`,
    [secondaryId],
    subNotes,
  );

  await add(
    "account_devices",
    `select count(*)::int as n from account_devices where user_id = $1::uuid`,
    `select 0::int as n where $1::text is not null`,
    [secondaryId],
  );

  await add(
    "account_sessions",
    `select 0::int as n where $1::text is not null`,
    `select count(*)::int as n from account_sessions
      where user_id = $1 and revoked_at is null`,
    [secondaryId],
    ["Secondary sessions will be revoked, not moved."],
  );

  await add(
    "promo_redemptions",
    `select count(*)::int as n from promo_redemptions s
      where s.user_id = $2
        and not exists (
          select 1 from promo_redemptions p
           where p.user_id = $1 and p.code = s.code
        )`,
    `select count(*)::int as n from promo_redemptions s
      where s.user_id = $2
        and exists (
          select 1 from promo_redemptions p
           where p.user_id = $1 and p.code = s.code
        )`,
    pair,
  );

  await add(
    "reward_claims",
    `select count(*)::int as n from reward_claims s
      where s.user_id = $2
        and not exists (
          select 1 from reward_claims p
           where p.user_id = $1
             and p.campaign_id = s.campaign_id
             and p.period_key is not distinct from s.period_key
        )`,
    `select count(*)::int as n from reward_claims s
      where s.user_id = $2
        and exists (
          select 1 from reward_claims p
           where p.user_id = $1
             and p.campaign_id = s.campaign_id
             and p.period_key is not distinct from s.period_key
        )`,
    pair,
  );

  await add(
    "reward_discount_reservations",
    `select count(*)::int as n from reward_discount_reservations
      where user_id = $1`,
    `select 0::int as n where $1::text is not null`,
    [secondaryId],
  );

  await add(
    "reward_cockpit_themes",
    `select count(*)::int as n from reward_cockpit_themes s
      where s.user_id = $2
        and not exists (
          select 1 from reward_cockpit_themes p
           where p.user_id = $1 and p.theme_id = s.theme_id
        )`,
    `select count(*)::int as n from reward_cockpit_themes s
      where s.user_id = $2
        and exists (
          select 1 from reward_cockpit_themes p
           where p.user_id = $1 and p.theme_id = s.theme_id
        )`,
    pair,
  );

  await add(
    "drive_special_usage",
    `select count(*)::int as n from drive_special_usage s
      where s.account_id = $2
        and not exists (
          select 1 from drive_special_usage p
           where p.account_id = $1 and p.day = s.day
        )`,
    `select count(*)::int as n from drive_special_usage s
      where s.account_id = $2
        and exists (
          select 1 from drive_special_usage p
           where p.account_id = $1 and p.day = s.day
        )`,
    pair,
  );

  const trialPrimary = (await tableExists(db, "dynamic_drive_trials"))
    ? await count(
        db,
        `select count(*)::int as n from dynamic_drive_trials where user_id = $1::uuid`,
        [primaryId],
      )
    : 0;
  await add(
    "dynamic_drive_trials",
    trialPrimary > 0
      ? `select 0::int as n where $1::text is not null`
      : `select count(*)::int as n from dynamic_drive_trials where user_id = $1::uuid`,
    trialPrimary > 0
      ? `select count(*)::int as n from dynamic_drive_trials where user_id = $1::uuid`
      : `select 0::int as n where $1::text is not null`,
    [secondaryId],
    trialPrimary > 0
      ? ["Both accounts have a Dynamic Drive trial. Leaving the primary row in place."]
      : [],
  );

  await add(
    "dynamic_drive_trial_sessions",
    `select count(*)::int as n from dynamic_drive_trial_sessions where user_id = $1::uuid`,
    `select 0::int as n where $1::text is not null`,
    [secondaryId],
  );

  const smileTotalAfter = await count(
    db,
    `select coalesce(sum(amount), 0)::int as n from (
        select amount from smile_ledger where user_id = $1
        union all
        select s.amount
          from smile_ledger s
         where s.user_id = $2
           and not exists (
             select 1 from smile_ledger p
              where p.user_id = $1 and p.reason = s.reason
                and p.ref is not distinct from s.ref
           )
      ) x`,
    pair,
  );

  return { moves, smileTotalAfter };
}

export async function buildMergePlan(
  db: SqlClient,
  opts: {
    primarySeat?: number;
    primaryId?: string;
    email?: string;
    /** Explicit secondary ids, including accounts with no email. */
    secondaryIds?: string[];
  } = {},
): Promise<MergePlan> {
  const primary =
    (opts.primaryId ? await findUserById(db, opts.primaryId) : null) ??
    (await findUserBySeat(db, opts.primarySeat ?? 1));
  if (!primary) {
    throw new Error("Primary account (Founder seat #1 by default) was not found.");
  }

  const explicitIds = [
    ...new Set((opts.secondaryIds ?? []).map((id) => id.trim()).filter(Boolean)),
  ];
  let secondaries: UserRow[] = [];
  if (explicitIds.length) {
    for (const id of explicitIds) {
      if (id === primary.id) {
        throw new Error("Primary and secondary must be different accounts.");
      }
      const row = await findUserById(db, id);
      if (!row) {
        throw new Error(`Secondary account ${id} was not found.`);
      }
      secondaries.push(row);
    }
  } else {
    const email = opts.email ?? primary.email;
    if (!email) {
      throw new Error(
        "Primary account has no email, so aliases cannot be matched. Pass --secondary <id> for an email-less account.",
      );
    }
    const samePerson = await findUsersByCanonicalEmail(db, email);
    secondaries = samePerson.filter((user) => user.id !== primary.id);
  }
  if (!secondaries.length) {
    return {
      primary,
      secondaries: [],
      moves: [],
      conflicts: [],
      smileTotalAfter: primary.smileTotal ?? 0,
    };
  }

  const moves: MoveCount[] = [];
  const conflicts: string[] = [];
  let smileTotalAfter = 0;
  for (const secondary of secondaries) {
    if (
      primary.stripeCustomerId &&
      secondary.stripeCustomerId &&
      primary.stripeCustomerId !== secondary.stripeCustomerId
    ) {
      conflicts.push(
        `Stripe customer conflict: primary ${primary.stripeCustomerId} vs ${secondary.id} ${secondary.stripeCustomerId}. Keeping the primary customer.`,
      );
    }
    const part = await collectMoves(db, primary.id, secondary.id);
    for (const move of part.moves) {
      const existing = moves.find((row) => row.table === move.table);
      if (existing) {
        existing.moved += move.moved;
        existing.skipped += move.skipped;
        existing.notes.push(...move.notes.filter((note) => !existing.notes.includes(note)));
      } else {
        moves.push({ ...move, notes: [...move.notes] });
      }
      for (const note of move.notes) {
        if (note.includes("Keeping") || note.includes("Leaving")) {
          if (!conflicts.includes(note)) conflicts.push(note);
        }
      }
    }
    smileTotalAfter = part.smileTotalAfter;
  }

  return { primary, secondaries, moves, conflicts, smileTotalAfter };
}

async function exec(db: SqlClient, text: string, params: unknown[] = []): Promise<void> {
  await db.query(text, params);
}

async function applyOne(db: SqlClient, primary: UserRow, secondary: UserRow): Promise<void> {
  const pair = [primary.id, secondary.id];

  if (await tableExists(db, "smiles_cards")) {
    await exec(
      db,
      `update smiles_cards s set user_id = $1
        where user_id = $2
          and not exists (
            select 1 from smiles_cards p
             where p.user_id = $1 and p.journey_id = s.journey_id
          )`,
      pair,
    );
    await exec(db, `delete from smiles_cards where user_id = $1`, [secondary.id]);
  }

  if (await tableExists(db, "smile_ledger")) {
    await exec(
      db,
      `update smile_ledger s set user_id = $1
        where user_id = $2
          and not exists (
            select 1 from smile_ledger p
             where p.user_id = $1 and p.reason = s.reason
               and p.ref is not distinct from s.ref
          )`,
      pair,
    );
    await exec(db, `delete from smile_ledger where user_id = $1`, [secondary.id]);
  }

  if (await tableExists(db, "founder_sound_picks")) {
    await exec(
      db,
      `update founder_sound_picks s set account_id = $1
        where account_id = $2
          and not exists (
            select 1 from founder_sound_picks p
             where p.account_id = $1 and p.sound_id = s.sound_id
          )`,
      pair,
    );
    await exec(db, `delete from founder_sound_picks where account_id = $1`, [secondary.id]);
  }

  if (await tableExists(db, "entitlement_grants")) {
    await exec(
      db,
      `update entitlement_grants s set user_id = $1::uuid
        where user_id = $2::uuid
          and not exists (
            select 1 from entitlement_grants p
             where p.user_id = $1::uuid
               and p.kind = s.kind
               and p.profile_id is not distinct from s.profile_id
               and p.entitlement is not distinct from s.entitlement
          )`,
      pair,
    );
    await exec(db, `delete from entitlement_grants where user_id = $1::uuid`, [secondary.id]);
  }

  if (await tableExists(db, "subscriptions")) {
    const primarySubs = await count(
      db,
      `select count(*)::int as n from subscriptions where user_id = $1::uuid`,
      [primary.id],
    );
    if (primarySubs === 0) {
      await exec(db, `update subscriptions set user_id = $1::uuid where user_id = $2::uuid`, pair);
    }
  }

  if (await tableExists(db, "account_devices")) {
    await exec(db, `update account_devices set user_id = $1::uuid where user_id = $2::uuid`, pair);
  }

  if (await tableExists(db, "account_sessions")) {
    await exec(
      db,
      `update account_sessions set revoked_at = coalesce(revoked_at, now())
        where user_id = $1 and revoked_at is null`,
      [secondary.id],
    );
  }

  if (await tableExists(db, "promo_redemptions")) {
    await exec(
      db,
      `update promo_redemptions s set user_id = $1
        where user_id = $2
          and not exists (
            select 1 from promo_redemptions p where p.user_id = $1 and p.code = s.code
          )`,
      pair,
    );
    await exec(db, `delete from promo_redemptions where user_id = $1`, [secondary.id]);
  }

  if (await tableExists(db, "reward_claims")) {
    await exec(
      db,
      `update reward_claims s set user_id = $1
        where user_id = $2
          and not exists (
            select 1 from reward_claims p
             where p.user_id = $1
               and p.campaign_id = s.campaign_id
               and p.period_key is not distinct from s.period_key
          )`,
      pair,
    );
  }

  if (await tableExists(db, "reward_discount_reservations")) {
    await exec(db, `update reward_discount_reservations set user_id = $1 where user_id = $2`, pair);
  }

  if (await tableExists(db, "reward_cockpit_themes")) {
    await exec(
      db,
      `update reward_cockpit_themes s set user_id = $1
        where user_id = $2
          and not exists (
            select 1 from reward_cockpit_themes p
             where p.user_id = $1 and p.theme_id = s.theme_id
          )`,
      pair,
    );
    await exec(db, `delete from reward_cockpit_themes where user_id = $1`, [secondary.id]);
  }

  if (await tableExists(db, "drive_special_usage")) {
    await exec(
      db,
      `update drive_special_usage s set account_id = $1
        where account_id = $2
          and not exists (
            select 1 from drive_special_usage p
             where p.account_id = $1 and p.day = s.day
          )`,
      pair,
    );
    await exec(db, `delete from drive_special_usage where account_id = $1`, [secondary.id]);
  }

  if (await tableExists(db, "dynamic_drive_trials")) {
    const primaryTrials = await count(
      db,
      `select count(*)::int as n from dynamic_drive_trials where user_id = $1::uuid`,
      [primary.id],
    );
    if (primaryTrials === 0) {
      await exec(
        db,
        `update dynamic_drive_trials set user_id = $1::uuid where user_id = $2::uuid`,
        pair,
      );
    }
  }

  if (await tableExists(db, "dynamic_drive_trial_sessions")) {
    await exec(
      db,
      `update dynamic_drive_trial_sessions set user_id = $1::uuid where user_id = $2::uuid`,
      pair,
    );
  }

  const crew = primary.testCrewOptIn || secondary.testCrewOptIn;
  const stripe =
    primary.stripeCustomerId ??
    (secondary.stripeCustomerId && !primary.stripeCustomerId
      ? secondary.stripeCustomerId
      : primary.stripeCustomerId);
  await exec(
    db,
    `update users
        set test_crew_opt_in = $2,
            stripe_customer_id = coalesce(stripe_customer_id, $3),
            smile_handle = coalesce(smile_handle, $4),
            smile_ref_code = coalesce(smile_ref_code, $5),
            updated_at = now()
      where id = $1::uuid`,
    [primary.id, crew, secondary.stripeCustomerId, secondary.smileHandle, secondary.smileRefCode],
  );

  await exec(
    db,
    `update users
        set founder_seat = null,
            founder_at = null,
            updated_at = now()
      where id = $1::uuid`,
    [secondary.id],
  );
}

async function recomputeSmileTotals(db: SqlClient, userId: string): Promise<number> {
  const rows = await db.query<{ bal: number | string; earned: number | string }>(
    `select coalesce(sum(amount), 0)::int as bal,
            coalesce(sum(amount) filter (where amount > 0), 0)::int as earned
       from smile_ledger
      where user_id = $1`,
    [userId],
  );
  const balance = Number(rows[0]?.bal ?? 0);
  const earned = Number(rows[0]?.earned ?? 0);
  let floor: string | null = null;
  try {
    const cur = await db.query<{ level: string | null; peak: string | null }>(
      `select smile_level as level, smile_level_peak as peak from users where id = $1::uuid`,
      [userId],
    );
    floor = cur[0]?.peak ?? cur[0]?.level ?? null;
  } catch {
    const cur = await db.query<{ level: string | null }>(
      `select smile_level as level from users where id = $1::uuid`,
      [userId],
    );
    floor = cur[0]?.level ?? null;
  }
  const level = smileLevelWithFloor(earned, floor).name;
  try {
    await exec(
      db,
      `update users set smile_total = $2, smile_level = $3, smile_level_peak = $3, updated_at = now() where id = $1::uuid`,
      [userId, balance, level],
    );
  } catch {
    await exec(
      db,
      `update users set smile_total = $2, smile_level = $3, updated_at = now() where id = $1::uuid`,
      [userId, balance, level],
    );
  }
  return balance;
}

export async function applyMergePlan(db: SqlClient, plan: MergePlan): Promise<MergePlan> {
  if (!plan.secondaries.length) return plan;
  return db.withTransaction(async (tx) => {
    const fresh = await buildMergePlan(tx, {
      primaryId: plan.primary.id,
      secondaryIds: plan.secondaries.map((row) => row.id),
    });
    for (const secondary of fresh.secondaries) {
      await applyOne(tx, fresh.primary, secondary);
    }
    const smileTotalAfter = await recomputeSmileTotals(tx, fresh.primary.id);
    const primary = (await findUserById(tx, fresh.primary.id))!;
    const secondaries = (
      await Promise.all(fresh.secondaries.map((row) => findUserById(tx, row.id)))
    ).filter((row): row is UserRow => Boolean(row));
    return { ...fresh, primary, secondaries, smileTotalAfter };
  });
}

export function formatMergePlan(plan: MergePlan, mode: "dry-run" | "applied"): string {
  const lines = [
    mode === "applied" ? "Account merge applied." : "Account merge dry run (no writes).",
    `Primary: ${plan.primary.id}  ${plan.primary.email ?? "(no email)"}  founder seat ${plan.primary.founderSeat ?? "none"}  smiles ${plan.primary.smileTotal ?? 0}`,
  ];
  if (!plan.secondaries.length) {
    lines.push("No secondary accounts with the same canonical email.");
    return lines.join("\n");
  }
  for (const secondary of plan.secondaries) {
    lines.push(
      `Secondary: ${secondary.id}  ${secondary.email ?? "(no email)"}  founder seat ${secondary.founderSeat ?? "none"}  smiles ${secondary.smileTotal ?? 0}`,
    );
  }
  lines.push("Moves:");
  for (const move of plan.moves) {
    if (move.moved === 0 && move.skipped === 0 && !move.notes.length) continue;
    const note = move.notes.length ? `  (${move.notes.join(" ")})` : "";
    lines.push(`  ${move.table}: move ${move.moved}, skip ${move.skipped}${note}`);
  }
  lines.push(`Smile total after merge: ${plan.smileTotalAfter}`);
  if (plan.conflicts.length) {
    lines.push("Conflicts / flags:");
    for (const conflict of plan.conflicts) lines.push(`  - ${conflict}`);
  }
  return lines.join("\n");
}

export function formatDuplicateGroups(groups: DuplicateGroup[]): string {
  if (!groups.length) return "No users share a canonical email or hold more than one Founder seat.";
  const lines = [`Possible duplicate accounts: ${groups.length} group(s).`];
  for (const group of groups) {
    const seats = group.founderSeats.length ? group.founderSeats.join(", ") : "none";
    lines.push(`- ${group.canonicalEmail}  seats [${seats}]`);
    for (const user of group.users) {
      lines.push(
        `    ${user.id}  ${user.email ?? "(no email)"}  seat ${user.founderSeat ?? "none"}  smiles ${user.smileTotal ?? 0}`,
      );
    }
  }
  return lines.join("\n");
}

export function isProbablyProductionDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (/localhost|127\.0\.0\.1|pglite/i.test(url)) return false;
  return /supabase|amazonaws|neon\.tech|railway|render\.com|elcamoso/i.test(url);
}

export function createPgliteSqlClient(client: {
  query: (text: string, params?: unknown[]) => Promise<{ rows?: unknown[] } | unknown[]>;
}): SqlClient {
  const query = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) => {
    const result = await client.query(text, params);
    if (Array.isArray(result)) return result as T[];
    return (result.rows ?? []) as T[];
  };
  const self: SqlClient = {
    query,
    async withTransaction(fn) {
      await query("begin");
      try {
        const out = await fn(self);
        await query("commit");
        return out;
      } catch (error) {
        try {
          await query("rollback");
        } catch {
          /* already aborted */
        }
        throw error;
      }
    },
  };
  return self;
}
