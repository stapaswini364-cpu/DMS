/**
 * CLI wrapper around src/lib/accounting/seed-coa.ts.
 * Usage: npx tsx scripts/seed-coa.ts <tenant-name-fragment>
 * Example: npx tsx scripts/seed-coa.ts basanti
 *
 * Only useful for local/manual runs — the super-admin dealership flow now
 * seeds automatically on tenant creation and exposes a "Seed Chart of Accounts"
 * button for retries. This script exists as a fallback and for use in
 * environments without app access (e.g. bootstrapping a fresh env from a
 * dev workstation).
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { ilike } from 'drizzle-orm'
import * as schema from '../src/db/schema'
import { seedChartOfAccounts } from '../src/lib/accounting/seed-coa'

const NAME_FRAGMENT = process.argv[2]
if (!NAME_FRAGMENT) {
  console.error('Usage: npx tsx scripts/seed-coa.ts <tenant-name-fragment>')
  console.error('       (name fragment is required — no default, to avoid seeding the wrong tenant)')
  process.exit(1)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set in .env.local')

  const client = postgres(url, { prepare: false })
  const db = drizzle(client, { schema })

  const matches = await db
    .select({ id: schema.tenants.id, name: schema.tenants.name })
    .from(schema.tenants)
    .where(ilike(schema.tenants.name, `%${NAME_FRAGMENT}%`))

  if (matches.length === 0) {
    console.error(`No tenant matching "%${NAME_FRAGMENT}%" found.`)
    await client.end()
    process.exit(1)
  }
  if (matches.length > 1) {
    console.error(
      `Ambiguous — ${matches.length} tenants match "%${NAME_FRAGMENT}%":\n` +
      matches.map(t => `  - ${t.name} (${t.id})`).join('\n') +
      `\nUse a more specific fragment.`,
    )
    await client.end()
    process.exit(1)
  }

  const tenant = matches[0]
  console.log(`Seeding COA for tenant: ${tenant.name} (${tenant.id})`)

  // The shared helper takes a Drizzle DB instance; pass the script-scoped one
  // so we're not spinning up a second connection pool.
  const result = await seedChartOfAccounts(tenant.id, db)

  if (result.alreadySeeded) {
    console.log(`COA already seeded for this tenant (${result.ledgerCount} ledgers). Exiting.`)
  } else {
    console.log(`COA seeded successfully — ${result.ledgerCount} ledgers created.`)
    console.log('  5 Account Types | 5 Major Heads | 9 Groups | 12 Sub Groups | 16 Ledgers')
  }

  await client.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
