import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;
/** A transaction handle; posting functions accept either the db or a tx. */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | Tx;

const globalForDb = globalThis as unknown as { __mandiSql?: postgres.Sql; __mandiDb?: DB };

export function createDb(url: string) {
  const client = postgres(url, { max: 10, types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } } });
  return { client, db: drizzle(client, { schema }) };
}

function init(): DB {
  if (!globalForDb.__mandiDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const { client, db } = createDb(url);
    globalForDb.__mandiSql = client;
    globalForDb.__mandiDb = db;
  }
  return globalForDb.__mandiDb;
}

/** Lazily-initialised shared connection (safe across Next.js hot reloads). */
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    const real = init() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

/** Test hook: point the shared `db` at another database. */
export function setDb(next: DB) {
  globalForDb.__mandiDb = next;
}

export { schema };
