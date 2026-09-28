import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { companySettings } from '@/db/schema/auth'

export type { CompanySettings } from '@/db/schema/auth'

export async function getCompanySettings(tenantId: string) {
  const [row] = await db
    .select()
    .from(companySettings)
    .where(eq(companySettings.tenantId, tenantId))
    .limit(1)
  return row ?? null
}

// Pure helper — returns FY bounds for a given date given fyStartMonth (1-12) and fyStartDay (1-31).
// Defaults match the Indian FY (April 1) so existing behaviour is preserved when settings are absent.
export function financialYearBounds(
  date: Date,
  fyStartMonth = 4,
  fyStartDay   = 1,
) {
  const m = date.getMonth() + 1 // 1-indexed
  const d = date.getDate()
  const y = date.getFullYear()
  const inThisYear = m > fyStartMonth || (m === fyStartMonth && d >= fyStartDay)
  const startYear  = inThisYear ? y : y - 1
  const endYear    = startYear + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    label: `${startYear}-${String(endYear).slice(2)}`,
    start: new Date(`${startYear}-${pad(fyStartMonth)}-${pad(fyStartDay)}T00:00:00.000Z`),
    end:   new Date(`${endYear}-${pad(fyStartMonth)}-${pad(fyStartDay)}T00:00:00.000Z`),
  }
}

// Returns the FY start date for the FY containing `asAt`.
export function fyStartForDate(asAt: Date, fyStartMonth = 4, fyStartDay = 1): Date {
  return financialYearBounds(asAt, fyStartMonth, fyStartDay).start
}

// Computes the ISO date string (YYYY-MM-DD) for the FY start containing today,
// using settings if provided, falling back to April 1.
export function currentFyStartIso(fyStartMonth = 4, fyStartDay = 1): string {
  return fyStartForDate(new Date(), fyStartMonth, fyStartDay).toISOString().slice(0, 10)
}
