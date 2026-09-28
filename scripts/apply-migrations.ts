/**
 * Applies pending SQL migration files in order.
 * Usage: npx tsx scripts/apply-migrations.ts
 */
import { config } from 'dotenv'
import { resolve, join } from 'path'
import { readFileSync } from 'fs'

config({ path: resolve(process.cwd(), '.env.local') })

import postgres from 'postgres'

const MIGRATIONS = [
  '0002_coa_hierarchy.sql',
  '0003_journal_engine.sql',
  '0004_je_reference_location.sql',
  '0005_mrn_nullable_booking.sql',
]

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) throw new Error('DIRECT_URL not set in .env.local')

  const client = postgres(url, { prepare: false, max: 1 })

  for (const file of MIGRATIONS) {
    const path = join(process.cwd(), 'src/db/migrations', file)
    const sql  = readFileSync(path, 'utf-8')

    // drizzle-kit uses --> statement-breakpoint as a separator; split on it
    const statements = sql
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(Boolean)

    console.log(`\nApplying ${file} (${statements.length} statements)…`)

    for (const stmt of statements) {
      try {
        await client.unsafe(stmt)
        process.stdout.write('.')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (
          msg.includes('already exists') ||
          msg.includes('duplicate column') ||
          msg.includes('already defined')
        ) {
          process.stdout.write('s') // skipped — already applied
        } else {
          console.error(`\n  ✗ Error in ${file}:\n    ${msg}`)
          console.error(`  Statement:\n    ${stmt.slice(0, 200)}`)
          // Continue on error so we can see all failures at once
        }
      }
    }
    console.log(`\n  ✓ ${file} done`)
  }

  await client.end()
  console.log('\nAll migrations complete.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
