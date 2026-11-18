import { sql, type SQL } from "drizzle-orm";

/** `lower(email) in ('a@gmail.com', 'a@googlemail.com')` for Drizzle queries. */
export function sqlLowerEmailIn(emailColumn: SQL | unknown, aliases: string[]): SQL {
  if (!aliases.length) return sql`false`;
  return sql`lower(${emailColumn}) in (${sql.join(
    aliases.map((alias) => sql`${alias}`),
    sql`, `,
  )})`;
}
