'use client'

import { useState, useRef } from 'react'
import LoadingSpinner from '@/app/components/ui/LoadingSpinner'

type SaleRow = {
  bookingNumber:       string
  bookingDate:         string | null
  status:              string
  salesType:           string
  locationName:        string | null
  customerName:        string | null
  customerPhone:       string | null
  customerEmail:       string | null
  customerAddress:     string | null
  customerState:       string | null
  customerPincode:     string | null
  frameNumber:         string | null
  engineNumber:        string | null
  modelName:           string | null
  variantName:         string | null
  colorName:           string | null
  exShowroomPrice:     string
  rtoAmount:           string
  insuranceAmount:     string
  onRoadPrice:         string
  extendedWarranty:    string
  amc:                 string
  handlingCharges:     string
  etcCharges:          string
  addonPrice:          string
  subTotal:            string
  discountType:        string | null
  discountAmount:      string
  grandTotal:          string
  exchangeVehicleNumber: string | null
  exchangeBrand:       string | null
  exchangeValue:       string
  financeType:         string | null
  financerName:        string | null
  financePersonName:   string | null
  financePersonPhone:  string | null
  financeAmount:       string
  deliveryOrderNumber: string | null
  bookingAmount:       string
  hpAmount:            string
  pendingAmount:       string
}

const today = () => new Date().toISOString().slice(0, 10)

const fmt = (n: string | null | undefined) =>
  n ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0'

function csvEscape(v: string | null | undefined): string {
  const s = v ?? ''
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const CSV_HEADERS = [
  'Booking No.', 'Booking Date', 'Status', 'Sales Type', 'Location',
  'Customer Name', 'Mobile', 'Email', 'Address', 'State', 'PIN Code',
  'Frame No.', 'Engine No.', 'Model', 'Variant', 'Color',
  'Ex-Showroom', 'RTO', 'Insurance', 'On-Road Price',
  'Extended Warranty', 'AMC', 'Handling Charges', 'Other Charges',
  'Accessories Total', 'Sub-Total',
  'Discount Type', 'Discount Amount', 'Grand Total',
  'Exchange Veh. No.', 'Exchange Veh. Brand', 'Exchange Value',
  'Finance Type', 'Financer Name', 'Finance Person Name', 'Finance Person Mobile', 'Finance Amount',
  'Delivery Order No.', 'Booking Amount', 'HP Amount', 'Pending Amount',
]

function rowToCsv(r: SaleRow): string {
  return [
    r.bookingNumber,
    r.bookingDate ? new Date(r.bookingDate).toLocaleDateString('en-IN') : '',
    r.status,
    r.salesType,
    r.locationName,
    r.customerName,
    r.customerPhone,
    r.customerEmail,
    r.customerAddress,
    r.customerState,
    r.customerPincode,
    r.frameNumber,
    r.engineNumber,
    r.modelName,
    r.variantName,
    r.colorName,
    r.exShowroomPrice,
    r.rtoAmount,
    r.insuranceAmount,
    r.onRoadPrice,
    r.extendedWarranty,
    r.amc,
    r.handlingCharges,
    r.etcCharges,
    r.addonPrice,
    r.subTotal,
    r.discountType,
    r.discountAmount,
    r.grandTotal,
    r.exchangeVehicleNumber,
    r.exchangeBrand,
    r.exchangeValue,
    r.financeType,
    r.financerName,
    r.financePersonName,
    r.financePersonPhone,
    r.financeAmount,
    r.deliveryOrderNumber,
    r.bookingAmount,
    r.hpAmount,
    r.pendingAmount,
  ].map(csvEscape).join(',')
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     'bg-[#F1F5F9] text-[#475569]',
  CONFIRMED: 'bg-[#DBEAFE] text-[#1D4ED8]',
  PAID:      'bg-[#DCFCE7] text-[#15803D]',
  DELIVERED: 'bg-[#F3E8FF] text-[#7E22CE]',
  CANCELLED: 'bg-[#FEE2E2] text-[#B91C1C]',
}

export default function SalesReportPage() {
  const firstLoad = useRef(false)
  const [fromDate, setFromDate] = useState(today)
  const [toDate,   setToDate]   = useState(today)
  const [rows,     setRows]     = useState<SaleRow[] | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSearch() {
    setLoading(true)
    setError(null)
    firstLoad.current = true
    try {
      const res = await fetch(`/api/reports/sales?fromDate=${fromDate}&toDate=${toDate}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setRows(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  function handleExport() {
    if (!rows?.length) return
    const lines = [CSV_HEADERS.join(','), ...rows.map(rowToCsv)]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-report-${fromDate}-to-${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#1E293B]">Sales Report</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>All sales bookings for a date range</p>
      </div>

      {/* Filters */}
      <div className="fp-card px-5 py-4 mb-6 flex flex-wrap gap-4 items-end" style={{ borderRadius: '12px' }}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: '#64748B' }}>From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="fp-input text-sm"
            style={{ width: '160px' }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: '#64748B' }}>To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="fp-input text-sm"
            style={{ width: '160px' }}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="fp-btn-primary text-sm px-5 py-2"
        >
          {loading ? <LoadingSpinner size={16} /> : 'Search'}
        </button>
        {rows && rows.length > 0 && (
          <button
            onClick={handleExport}
            className="text-sm px-5 py-2 rounded-lg font-medium"
            style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 text-sm px-4 py-3 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
          Error: {error}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size={32} />
        </div>
      ) : rows === null ? (
        <div className="fp-card py-16 text-center text-sm" style={{ color: '#94A3B8', borderRadius: '12px' }}>
          Select a date range and click Search.
        </div>
      ) : rows.length === 0 ? (
        <div className="fp-card py-16 text-center text-sm" style={{ color: '#94A3B8', borderRadius: '12px' }}>
          No sales records found.
        </div>
      ) : (
        <div className="fp-card overflow-hidden" style={{ borderRadius: '12px' }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <span className="text-xs font-medium" style={{ color: '#64748B' }}>
              {rows.length} record{rows.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs" style={{ color: '#94A3B8' }}>
              {fromDate} — {toDate}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-sm text-left fp-table">
              <thead>
                <tr>
                  {['Booking No.', 'Date', 'Customer', 'Frame No.', 'Model', 'Status', 'Grand Total'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs font-semibold" style={{ color: '#1E293B' }}>
                      {r.bookingNumber}
                    </td>
                    <td className="text-xs whitespace-nowrap" style={{ color: '#94A3B8' }}>
                      {r.bookingDate
                        ? new Date(r.bookingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td>
                      <div className="text-xs font-medium text-[#1E293B]">{r.customerName ?? '—'}</div>
                      {r.customerPhone && (
                        <div className="text-xs" style={{ color: '#94A3B8' }}>{r.customerPhone}</div>
                      )}
                    </td>
                    <td className="font-mono text-xs" style={{ color: '#475569' }}>{r.frameNumber ?? '—'}</td>
                    <td className="text-xs">
                      <div style={{ color: '#1E293B' }}>{r.modelName ?? '—'}</div>
                      {r.variantName && <div style={{ color: '#94A3B8' }}>{r.variantName}</div>}
                    </td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] ?? 'bg-[#F1F5F9] text-[#475569]'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="text-sm font-semibold" style={{ color: '#1E293B' }}>
                      ₹ {fmt(r.grandTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 flex justify-end" style={{ borderTop: '1px solid #F1F5F9', background: '#F8FAFC' }}>
            <span className="text-xs font-medium" style={{ color: '#64748B' }}>
              Grand Total Sum: ₹ {rows.reduce((s, r) => s + Number(r.grandTotal), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
