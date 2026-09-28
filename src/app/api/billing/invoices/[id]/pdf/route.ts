export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { bookings } from '@/db/schema/bookings'
import { serviceBookings } from '@/db/schema/services'
import { invoices } from '@/db/schema/invoices'
import { requireTenant } from '@/lib/api-auth'
import { buildInvoiceData, type InvoiceData } from '@/lib/invoice'
import { buildServiceInvoiceData, type ServiceInvoiceData } from '@/lib/service-invoice'

type Ctx = { params: Promise<{ id: string }> }

// ── HTML renderer ─────────────────────────────────────────────────────────────

function fmt(n: string | number) {
  return `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function renderHtml(inv: InvoiceData): string {
  const addonsAmt   = Number(inv.pricing.addonPrice)
  const discountAmt = Number(inv.pricing.discountAmount)
  const onRoad = Number(inv.pricing.exShowroomPrice)
             + Number(inv.pricing.rtoAmount)
             + Number(inv.pricing.insuranceAmount)

  const gstRows = (() => {
    if ('cgst' in inv.gst && inv.gst.cgst) {
      return `
        <tr><td>CGST @ ${inv.gst.cgst.rate}%</td><td>${fmt(inv.gst.cgst.amount)}</td></tr>
        <tr><td>SGST @ ${inv.gst.sgst!.rate}%</td><td>${fmt(inv.gst.sgst!.amount)}</td></tr>`
    }
    if ('igst' in inv.gst && inv.gst.igst) {
      return `<tr><td>IGST @ ${inv.gst.igst.rate}%</td><td>${fmt(inv.gst.igst.amount)}</td></tr>`
    }
    return ''
  })()

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Invoice ${inv.invoiceNumber}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 13px;
    color: #111;
    background: #fff;
    padding: 32px;
    max-width: 800px;
    margin: 0 auto;
  }

  /* ── Header ── */
  .header {
    text-align: center;
    border-bottom: 2px solid #111;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .header .brand {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 2px;
    color: #1a1a1a;
  }
  .header .tagline {
    font-size: 10px;
    color: #666;
    letter-spacing: 1px;
    margin-top: 2px;
  }
  .header .invoice-title {
    font-size: 15px;
    font-weight: 600;
    margin-top: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  /* ── Two-column meta ── */
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }
  .meta-box h4 {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
    margin-bottom: 6px;
  }
  .meta-box p {
    font-size: 12px;
    line-height: 1.6;
    color: #222;
  }
  .meta-box .name { font-weight: 700; font-size: 14px; }

  /* ── Section heading ── */
  .section-title {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
    border-top: 1px solid #ddd;
    padding-top: 12px;
    margin-top: 12px;
    margin-bottom: 8px;
  }

  /* ── Table ── */
  table {
    width: 100%;
    border-collapse: collapse;
  }
  table td {
    padding: 5px 0;
    vertical-align: top;
  }
  table td:last-child {
    text-align: right;
    white-space: nowrap;
  }
  .row-subtle td { color: #555; }
  .row-divider td { border-top: 1px solid #ddd; padding-top: 8px; }
  .row-bold td { font-weight: 700; font-size: 14px; }
  .row-grand td { font-weight: 700; font-size: 15px; border-top: 2px solid #111; padding-top: 10px; }
  .row-negative td:last-child { color: #c0392b; }

  /* ── Footer ── */
  .footer {
    margin-top: 32px;
    border-top: 1px solid #ddd;
    padding-top: 12px;
    font-size: 10px;
    color: #888;
    text-align: center;
    line-height: 1.8;
  }

  /* ── Print ── */
  @media print {
    body { padding: 16px; }
    @page { size: A4; margin: 16mm 12mm; }
  }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="brand">Dealer Management System</div>
  <div class="invoice-title">Tax Invoice</div>
</div>

<!-- Seller / Buyer / Invoice meta -->
<div class="meta-grid">
  <div class="meta-box">
    <h4>From (Seller)</h4>
    <p class="name">${inv.seller.name}</p>
    <p>${inv.seller.address ?? ''}</p>
  </div>
  <div class="meta-box">
    <h4>To (Buyer)</h4>
    <p class="name">${inv.buyer.name}</p>
    ${inv.buyer.phone ? `<p>${inv.buyer.phone}</p>` : ''}
    ${inv.buyer.email ? `<p>${inv.buyer.email}</p>` : ''}
    ${inv.buyer.address ? `<p>${inv.buyer.address}</p>` : ''}
  </div>
</div>

<div class="meta-grid" style="margin-top:-8px">
  <div class="meta-box">
    <h4>Invoice Number</h4>
    <p style="font-weight:600">${inv.invoiceNumber}</p>
  </div>
  <div class="meta-box">
    <h4>Invoice Date</h4>
    <p>${inv.invoiceDate}</p>
  </div>
  <div class="meta-box">
    <h4>Booking Number</h4>
    <p>${inv.bookingNumber}</p>
  </div>
  <div class="meta-box">
    <h4>Sales Type</h4>
    <p>${inv.payment.salesType}</p>
  </div>
</div>

${inv.vehicle ? `
<!-- Vehicle Details -->
<div class="section-title">Vehicle Details</div>
<table>
  <tr class="row-subtle">
    <td>Model &amp; Variant</td>
    <td>${inv.vehicle.brand} ${inv.vehicle.model} — ${inv.vehicle.variant}</td>
  </tr>
  <tr class="row-subtle">
    <td>Colour</td>
    <td>${inv.vehicle.color}</td>
  </tr>
  ${inv.vehicle.frameNumber ? `<tr class="row-subtle"><td>Frame No.</td><td>${inv.vehicle.frameNumber}</td></tr>` : ''}
</table>
` : ''}

<!-- Pricing Breakdown -->
<div class="section-title">Pricing Breakdown</div>
<table>
  <tr class="row-subtle"><td>Ex-Showroom Price</td><td>${fmt(inv.pricing.exShowroomPrice)}</td></tr>
  <tr class="row-subtle"><td>RTO</td><td>${fmt(inv.pricing.rtoAmount)}</td></tr>
  <tr class="row-subtle"><td>Insurance</td><td>${fmt(inv.pricing.insuranceAmount)}</td></tr>
  <tr class="row-subtle row-divider"><td>On-Road Price</td><td>${fmt(onRoad)}</td></tr>
  ${addonsAmt > 0 ? `<tr class="row-subtle"><td>Add-ons</td><td>${fmt(addonsAmt)}</td></tr>` : ''}
  ${discountAmt > 0 ? `<tr class="row-subtle row-negative"><td>Discount</td><td>− ${fmt(discountAmt)}</td></tr>` : ''}
  <tr class="row-bold row-divider"><td>Grand Total</td><td>${fmt(inv.pricing.grandTotal)}</td></tr>
</table>

<!-- GST Breakdown -->
<div class="section-title">GST Details (${inv.gst.type})</div>
<table>
  <tr class="row-subtle"><td>Taxable Amount</td><td>${fmt(inv.gst.taxableAmount)}</td></tr>
  ${gstRows}
  <tr class="row-subtle row-divider"><td>Total GST</td><td>${fmt(inv.gst.totalGst)}</td></tr>
</table>

${inv.tcs ? `
<!-- TCS -->
<div class="section-title">TCS</div>
<table>
  <tr class="row-subtle"><td>TCS @ ${inv.tcs.rate}% (vehicle value &gt; ₹10 L)</td><td>${fmt(inv.tcs.amount)}</td></tr>
</table>
` : ''}

<!-- Invoice Total -->
<div style="margin-top:16px">
<table>
  <tr class="row-grand">
    <td>Invoice Total</td>
    <td>${fmt(inv.invoiceTotal)}</td>
  </tr>
</table>
</div>

<div class="footer">
  This is a computer-generated invoice and does not require a physical signature.
</div>

<script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`
}

// ── Service invoice HTML renderer ─────────────────────────────────────────────

function renderServiceHtml(inv: ServiceInvoiceData): string {
  const rows = inv.items.map(item => {
    const gst = item.isGstApplicable ? item.amount * (item.gstPercent / 100) : 0
    return `<tr class="row-subtle">
      <td>${item.itemName}</td>
      <td>${item.isGstApplicable ? `${item.gstPercent}%` : 'Nil'}</td>
      <td>${fmt(item.amount)}</td>
      <td>${fmt(gst)}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Invoice ${inv.invoiceNumber}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 32px; max-width: 800px; margin: 0 auto; }
  .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 20px; }
  .header .brand { font-size: 26px; font-weight: 800; letter-spacing: 2px; }
  .header .tagline { font-size: 10px; color: #666; letter-spacing: 1px; margin-top: 2px; }
  .header .invoice-title { font-size: 15px; font-weight: 600; margin-top: 10px; text-transform: uppercase; letter-spacing: 1px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .meta-box h4 { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
  .meta-box p { font-size: 12px; line-height: 1.6; color: #222; }
  .meta-box .name { font-weight: 700; font-size: 14px; }
  .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; border-top: 1px solid #ddd; padding-top: 12px; margin-top: 12px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  table td, table th { padding: 5px 0; vertical-align: top; }
  table th { font-size: 10px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table td:last-child, table th:last-child { text-align: right; white-space: nowrap; }
  .row-subtle td { color: #555; }
  .row-bold td { font-weight: 700; font-size: 14px; }
  .row-grand td { font-weight: 700; font-size: 15px; border-top: 2px solid #111; padding-top: 10px; }
  .row-negative td:last-child { color: #c0392b; }
  .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 10px; color: #888; text-align: center; line-height: 1.8; }
  @media print { body { padding: 16px; } @page { size: A4; margin: 16mm 12mm; } }
</style>
</head>
<body>
<div class="header">
  <div class="brand">Dealer Management System</div>
  <div class="invoice-title">Service Tax Invoice</div>
</div>
<div class="meta-grid">
  <div class="meta-box"><h4>From (Seller)</h4><p class="name">${inv.seller.name}</p>${inv.seller.address ? `<p>${inv.seller.address}</p>` : ''}</div>
  <div class="meta-box"><h4>To (Buyer)</h4><p class="name">${inv.customer.name}</p>${inv.customer.phone ? `<p>${inv.customer.phone}</p>` : ''}${inv.customer.email ? `<p>${inv.customer.email}</p>` : ''}</div>
</div>
<div class="meta-grid" style="margin-top:-8px">
  <div class="meta-box"><h4>Invoice Number</h4><p style="font-weight:600">${inv.invoiceNumber}</p></div>
  <div class="meta-box"><h4>Invoice Date</h4><p>${inv.invoiceDate}</p></div>
  <div class="meta-box"><h4>Job Card Number</h4><p>${inv.jobCardNumber}</p></div>
  <div class="meta-box"><h4>Vehicle</h4><p>${[inv.vehicle.model, inv.vehicle.variant].filter(Boolean).join(' ')}${inv.vehicle.frameNumber ? ` · ${inv.vehicle.frameNumber}` : ''}</p></div>
</div>
${inv.items.length > 0 ? `
<div class="section-title">Service Items</div>
<table>
  <thead><tr><th>Item</th><th>GST %</th><th>Amount</th><th>GST Amt</th></tr></thead>
  <tbody>${rows}</tbody>
</table>` : ''}
<div style="margin-top:16px">
<table>
  <tr class="row-subtle"><td>Sub Total</td><td>${fmt(inv.pricing.subTotal)}</td></tr>
  ${inv.pricing.discount > 0 ? `<tr class="row-subtle row-negative"><td>Discount</td><td>− ${fmt(inv.pricing.discount)}</td></tr>` : ''}
  <tr class="row-grand"><td>Invoice Total</td><td>${fmt(inv.pricing.finalNetAmount)}</td></tr>
</table>
</div>
<div class="footer">This is a computer-generated invoice and does not require a physical signature.</div>
<script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { tenant, err } = await requireTenant()
  if (err) return err

  const { id } = await params

  // Look up stored invoice number first (set by the manual generate flow)
  const [storedInvoice] = await db
    .select({ invoiceNumber: invoices.invoiceNumber, serviceBookingId: invoices.serviceBookingId })
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenant.id), eq(invoices.bookingId, id)))
    .limit(1)

  // If there's a stored invoice for a service booking under this id, render service PDF
  if (!storedInvoice) {
    // Check if it's a service booking with a stored invoice
    const [svcInvoice] = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenant.id), eq(invoices.serviceBookingId, id)))
      .limit(1)

    if (svcInvoice) {
      const data = await buildServiceInvoiceData(id, tenant.id, svcInvoice.invoiceNumber)
      if (!data) return NextResponse.json({ error: 'Service booking not found' }, { status: 404 })
      return new Response(renderServiceHtml(data), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': 'inline' },
      })
    }
  }

  // Check if this is a service booking (preview before invoice generation)
  const [svcBooking] = await db
    .select({ id: serviceBookings.id, status: serviceBookings.status })
    .from(serviceBookings)
    .where(and(eq(serviceBookings.id, id), eq(serviceBookings.tenantId, tenant.id)))
    .limit(1)

  if (svcBooking) {
    const data = await buildServiceInvoiceData(id, tenant.id, 'DRAFT')
    if (!data) return NextResponse.json({ error: 'Service booking not found' }, { status: 404 })
    return new Response(renderServiceHtml(data), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': 'inline' },
    })
  }

  // Sales booking PDF (with stored invoice number override if available)
  const [booking] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenant.id)))
    .limit(1)

  if (!booking) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (booking.status !== 'CONFIRMED' && booking.status !== 'DELIVERED') {
    return NextResponse.json(
      { error: 'PDF only available for CONFIRMED or DELIVERED bookings' },
      { status: 400 },
    )
  }

  const invoice = await buildInvoiceData(id, tenant.id, storedInvoice?.invoiceNumber)
  if (!invoice) return NextResponse.json({ error: 'Failed to build invoice' }, { status: 500 })

  return new Response(renderHtml(invoice), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': 'inline' },
  })
}
