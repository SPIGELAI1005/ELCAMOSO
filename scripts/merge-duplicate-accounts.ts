#!/usr/bin/env npx tsx
/**
 * Find and merge ELCAMOSO accounts that are the same person (gmail/googlemail
 * aliases, or several user ids sharing one canonical email).
 *
 * Default is a dry run and prints the plan. It does not write to the database.
 *
 * Usage:
 *   npm run accounts:merge
 *   npm run accounts:merge -- --find-duplicates
 *   npm run accounts:merge -- --apply --allow-production
 *
 * --apply runs the merge in one transaction. --allow-production is required
 * when DATABASE_URL looks like the live database. Do not run --apply unless
 * George has reviewed the dry-run plan and explicitly said to apply it.
 */
import postgres from "postgres";

import {
  applyMergePlan,
  buildMergePlan,
  findDuplicateAccountGroups,
  formatDuplicateGroups,
  formatMergePlan,
  isProbablyProductionDatabaseUrl,
  type SqlClient,
} from "../src/lib/account/merge-duplicate-accounts.ts";

function printUsage(): void {
  console.log(`Usage:
  npm run accounts:merge
  npm run accounts:merge -- --find-duplicates
  npm run accounts:merge -- --primary-seat 1
  npm run accounts:merge -- --apply --allow-production

Default: dry-run merge of Founder seat #1 with every other account that
shares the same canonical email (gmail.com and googlemail.com count as one).

Requires DATABASE_URL. --apply writes in one transaction after you have
reviewed the dry-run plan. A production-looking DATABASE_URL also needs
--allow-production.`);
}

function createPostgresSqlClient(url: string): { db: SqlClient; close: () => Promise<void> } {
  const sql = postgres(url, { max: 1, prepare: false });
  const db: SqlClient = {
    query: async (text, params = []) => {
      const rows = await sql.unsafe(text, params as never[]);
      return [...rows] as Record<string, unknown>[];
    },
    withTransaction: async (fn) =>
      sql.begin(async (tx) => {
        const inner: SqlClient = {
          query: async (text, params = []) => {
            const rows = await tx.unsafe(text, params as never[]);
            return [...rows] as Record<string, unknown>[];
          },
          withTransaction: (nested) => nested(inner),
        };
        return fn(inner);
      }),
  };
  return { db, close: () => sql.end({ timeout: 5 }) };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  const apply = args.includes("--apply");
  const allowProduction = args.includes("--allow-production");
  const findDuplicates = args.includes("--find-duplicates");
  const seatFlag = args.indexOf("--primary-seat");
  const primarySeat = seatFlag >= 0 ? Number(args[seatFlag + 1]) : 1;
  const idFlag = args.indexOf("--primary-id");
  const primaryId = idFlag >= 0 ? args[idFlag + 1] : undefined;

  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("DATABASE_URL is not set. This script will not guess a database.");
    process.exit(1);
  }

  if (apply && isProbablyProductionDatabaseUrl(url) && !allowProduction) {
    console.error(
      "DATABASE_URL looks like the live database. Re-run the dry run first, then only use --apply --allow-production after George has explicitly approved the plan.",
    );
    process.exit(1);
  }

  const { db, close } = createPostgresSqlClient(url);
  try {
    const groups = await findDuplicateAccountGroups(db);
    console.log(formatDuplicateGroups(groups));
    console.log("");
    if (findDuplicates && !apply) return;

    const plan = await buildMergePlan(db, {
      primarySeat: Number.isFinite(primarySeat) ? primarySeat : 1,
      ...(primaryId ? { primaryId } : {}),
    });
    console.log(formatMergePlan(plan, "dry-run"));
    if (!apply) return;

    const applied = await applyMergePlan(db, plan);
    console.log("");
    console.log(formatMergePlan(applied, "applied"));
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
