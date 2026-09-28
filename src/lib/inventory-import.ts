import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  vehicleInventory,
  productModels,
  productVariants,
  productColors,
} from '@/db/schema/inventory'
import { locations } from '@/db/schema/auth'

export type ImportRawRow = {
  frameNumber?: string
  engineNumber?: string
  model?: string
  variant?: string
  color?: string
  location?: string
  purchaseDate?: string
  expectedDeliveryDate?: string
}

export type ImportValidRow = {
  rowNumber: number
  raw: ImportRawRow
  resolved: {
    frameNumber: string
    engineNumber: string
    variantId: string
    colorId: string
    locationId: string
    purchaseDate: string | null
    expectedDeliveryDate: string | null
    modelLabel: string
    variantLabel: string
    colorLabel: string
    locationLabel: string
  }
}

export type ImportInvalidRow = {
  rowNumber: number
  raw: ImportRawRow
  reason: string
}

export type ImportValidationResult = {
  totalCount: number
  validCount: number
  invalidCount: number
  valid: ImportValidRow[]
  invalid: ImportInvalidRow[]
}

const norm = (s: string | undefined | null): string => (s ?? '').trim().toLowerCase()

function isValidIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(v + 'T00:00:00Z')
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

export async function validateImportRows(
  tenantId: string,
  rows: ImportRawRow[],
): Promise<ImportValidationResult> {
  const [modelsList, variantsList, colorsList, locationsList, existingVehicles] =
    await Promise.all([
      db.select().from(productModels).where(eq(productModels.tenantId, tenantId)),
      db.select().from(productVariants).where(eq(productVariants.tenantId, tenantId)),
      db.select().from(productColors).where(eq(productColors.tenantId, tenantId)),
      db.select().from(locations).where(eq(locations.tenantId, tenantId)),
      db
        .select({
          frameNumber: vehicleInventory.frameNumber,
          engineNumber: vehicleInventory.engineNumber,
        })
        .from(vehicleInventory)
        .where(eq(vehicleInventory.tenantId, tenantId)),
    ])

  const modelsByName = new Map<string, typeof modelsList>()
  for (const m of modelsList) {
    const key = norm(m.name)
    const arr = modelsByName.get(key) ?? []
    arr.push(m)
    modelsByName.set(key, arr)
  }

  const variantsByModelAndName = new Map<string, (typeof variantsList)[number]>()
  for (const v of variantsList) {
    variantsByModelAndName.set(`${v.modelId}|${norm(v.name)}`, v)
  }

  const colorsByVariantAndName = new Map<string, (typeof colorsList)[number]>()
  for (const c of colorsList) {
    colorsByVariantAndName.set(`${c.variantId}|${norm(c.colorName)}`, c)
  }

  const locationByName = new Map<string, (typeof locationsList)[number]>()
  for (const l of locationsList) {
    locationByName.set(norm(l.name), l)
  }

  const existingFrames = new Set(existingVehicles.map(v => v.frameNumber.toUpperCase()))
  const existingEngines = new Set(existingVehicles.map(v => v.engineNumber.toUpperCase()))

  const seenFrames = new Map<string, number>()
  const seenEngines = new Map<string, number>()

  const valid: ImportValidRow[] = []
  const invalid: ImportInvalidRow[] = []

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 1
    const frame = (raw.frameNumber ?? '').trim().toUpperCase()
    const engine = (raw.engineNumber ?? '').trim().toUpperCase()
    const modelName = (raw.model ?? '').trim()
    const variantName = (raw.variant ?? '').trim()
    const colorName = (raw.color ?? '').trim()
    const locationName = (raw.location ?? '').trim()
    const purchase = (raw.purchaseDate ?? '').trim()
    const delivery = (raw.expectedDeliveryDate ?? '').trim()

    if (!frame) return invalid.push({ rowNumber, raw, reason: 'Frame Number is required' })
    if (!engine) return invalid.push({ rowNumber, raw, reason: 'Engine Number is required' })
    if (!modelName) return invalid.push({ rowNumber, raw, reason: 'Model is required' })
    if (!variantName) return invalid.push({ rowNumber, raw, reason: 'Variant is required' })
    if (!colorName) return invalid.push({ rowNumber, raw, reason: 'Color is required' })
    if (!locationName) return invalid.push({ rowNumber, raw, reason: 'Location is required' })

    const dupFrameRow = seenFrames.get(frame)
    if (dupFrameRow !== undefined) {
      return invalid.push({
        rowNumber, raw,
        reason: `Frame number ${frame} is duplicated in this file (also on row ${dupFrameRow})`,
      })
    }
    const dupEngineRow = seenEngines.get(engine)
    if (dupEngineRow !== undefined) {
      return invalid.push({
        rowNumber, raw,
        reason: `Engine number ${engine} is duplicated in this file (also on row ${dupEngineRow})`,
      })
    }
    seenFrames.set(frame, rowNumber)
    seenEngines.set(engine, rowNumber)

    if (existingFrames.has(frame)) {
      return invalid.push({ rowNumber, raw, reason: `Frame number ${frame} already exists` })
    }
    if (existingEngines.has(engine)) {
      return invalid.push({ rowNumber, raw, reason: `Engine number ${engine} already exists` })
    }

    const modelMatches = modelsByName.get(norm(modelName)) ?? []
    if (modelMatches.length === 0) {
      return invalid.push({ rowNumber, raw, reason: `Model '${modelName}' not found — check spelling` })
    }
    if (modelMatches.length > 1) {
      return invalid.push({
        rowNumber, raw,
        reason: `Model '${modelName}' is ambiguous (matches ${modelMatches.length} products) — rename in Master Data`,
      })
    }
    const model = modelMatches[0]

    const variant = variantsByModelAndName.get(`${model.id}|${norm(variantName)}`)
    if (!variant) {
      return invalid.push({
        rowNumber, raw,
        reason: `Variant '${variantName}' not found under model '${model.name}'`,
      })
    }

    const color = colorsByVariantAndName.get(`${variant.id}|${norm(colorName)}`)
    if (!color) {
      return invalid.push({
        rowNumber, raw,
        reason: `Color '${colorName}' not found under variant '${variant.name}'`,
      })
    }

    const location = locationByName.get(norm(locationName))
    if (!location) {
      return invalid.push({ rowNumber, raw, reason: `Location '${locationName}' not found` })
    }

    if (purchase && !isValidIsoDate(purchase)) {
      return invalid.push({ rowNumber, raw, reason: `Purchase Date must be YYYY-MM-DD (got '${purchase}')` })
    }
    if (delivery && !isValidIsoDate(delivery)) {
      return invalid.push({ rowNumber, raw, reason: `Expected Delivery Date must be YYYY-MM-DD (got '${delivery}')` })
    }

    valid.push({
      rowNumber,
      raw,
      resolved: {
        frameNumber: frame,
        engineNumber: engine,
        variantId: variant.id,
        colorId: color.id,
        locationId: location.id,
        purchaseDate: purchase || null,
        expectedDeliveryDate: delivery || null,
        modelLabel: `${model.brand} ${model.name}`,
        variantLabel: variant.name,
        colorLabel: color.colorName,
        locationLabel: location.name,
      },
    })
  })

  return {
    totalCount: rows.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    valid,
    invalid,
  }
}

export async function insertValidatedRows(
  tenantId: string,
  validRows: ImportValidRow[],
): Promise<{ inserted: ImportValidRow[]; failed: ImportInvalidRow[] }> {
  const inserted: ImportValidRow[] = []
  const failed: ImportInvalidRow[] = []

  for (const row of validRows) {
    try {
      await db.insert(vehicleInventory).values({
        tenantId,
        variantId: row.resolved.variantId,
        colorId: row.resolved.colorId,
        frameNumber: row.resolved.frameNumber,
        engineNumber: row.resolved.engineNumber,
        locationId: row.resolved.locationId,
        status: 'AVAILABLE',
        purchaseDate: row.resolved.purchaseDate,
        expectedDeliveryDate: row.resolved.expectedDeliveryDate,
      })
      inserted.push(row)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      let reason = 'Insert failed'
      if (msg.includes('engine_number')) reason = `Engine number ${row.resolved.engineNumber} already exists`
      else if (msg.includes('frame_number')) reason = `Frame number ${row.resolved.frameNumber} already exists`
      failed.push({ rowNumber: row.rowNumber, raw: row.raw, reason })
    }
  }

  return { inserted, failed }
}
