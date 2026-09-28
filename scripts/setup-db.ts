import { config } from 'dotenv'
import { readFileSync, readdirSync } from 'fs'
import postgres from 'postgres'

config({ path: '.env.local' })

async function main() {
  const url = process.env.DIRECT_URL
  if (!url) throw new Error('DIRECT_URL not set')
  const sql = postgres(url, { prepare: false, max: 1 })
  const dir = 'src/db/migrations/'
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  for (const f of files) {
    const parts = readFileSync(dir + f, 'utf-8').split('--> statement-breakpoint')
    console.log('Applying', f)
    for (const p of parts) {
      if (p.trim()) await sql.unsafe(p)
    }
  }
  await sql.end()
  console.log('Database ready.')
}

main().catch(e => { console.error(e); process.exit(1) })