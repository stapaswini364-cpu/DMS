import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>

let _db: DrizzleDB | null = null

export function getDb(): DrizzleDB {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  // `prepare: false` required for Supabase Transaction pool (port 6543).
  const client = postgres(url, { prepare: false })
  _db = drizzle(client, { schema })
  return _db
}

// Proxy: all property access is deferred to request time — never runs at build time.
export const db = new Proxy({} as DrizzleDB, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver)
  },
})

export type DB = DrizzleDB
export { schema }
