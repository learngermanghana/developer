import { describe, expect, it } from 'vitest'

import { buildReceiptPrintHtml } from '../Sell'

describe('buildReceiptPrintHtml', () => {
  const baseOptions = {
    saleId: 'sale-123',
    items: [{ name: 'Bottle Water', qty: 1, price: 5 }],
    totals: { subTotal: 5, taxTotal: 0.5, discount: 0, total: 5.5 },
    paymentMethod: 'cash' as const,
    discountInput: '',
    amountPaid: 6,
    changeDue: 0.5,
    receiptSize: '58mm' as const,
  }

  it('builds 58mm receipt print html with constrained paper width', () => {
    const html = buildReceiptPrintHtml(baseOptions, '2026-04-05 12:00')

    expect(html).toContain('@page { size: 58mm auto; margin: 0; }')
    expect(html).toContain('width: 58mm;')
    expect(html).toContain('max-width: 58mm;')
    expect(html).toContain('width: 48mm;')
    expect(html).toContain('<h1>Sale receipt</h1>')
  })

  it('builds 80mm receipt print html with constrained paper width', () => {
    const html = buildReceiptPrintHtml({ ...baseOptions, receiptSize: '80mm' }, '2026-04-05 12:00')

    expect(html).toContain('@page { size: 80mm auto; margin: 0; }')
    expect(html).toContain('width: 80mm;')
    expect(html).toContain('max-width: 80mm;')
    expect(html).toContain('width: 72mm;')
    expect(html).toContain('@media print')
  })
})
