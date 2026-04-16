import React, { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import { useActiveStore } from '../hooks/useActiveStore'

type BookingRecord = {
  id: string
  serviceId: string
  status: string
  quantity: number
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  notes: string | null
  createdAt: Date | null
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return `${value.toLocaleDateString()} ${value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export default function Bookings() {
  const { storeId } = useActiveStore()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [bookings, setBookings] = useState<BookingRecord[]>([])

  useEffect(() => {
    if (!storeId) {
      setBookings([])
      setLoading(false)
      setErrorMessage('Select a workspace to view bookings.')
      return
    }

    setLoading(true)
    setErrorMessage(null)
    const bookingsQuery = query(
      collection(db, 'stores', storeId, 'integrationBookings'),
      orderBy('createdAt', 'desc'),
      limit(100),
    )

    const unsubscribe = onSnapshot(
      bookingsQuery,
      snapshot => {
        const rows = snapshot.docs.map(docSnap => {
          const data = docSnap.data() as Record<string, any>
          const customer =
            data.customer && typeof data.customer === 'object'
              ? (data.customer as Record<string, unknown>)
              : {}
          const createdAtValue =
            data.createdAt && typeof data.createdAt === 'object' && typeof data.createdAt.toDate === 'function'
              ? data.createdAt.toDate()
              : null
          return {
            id: docSnap.id,
            serviceId: typeof data.serviceId === 'string' ? data.serviceId : '—',
            status: typeof data.status === 'string' ? data.status : 'confirmed',
            quantity:
              typeof data.quantity === 'number' && Number.isFinite(data.quantity)
                ? Math.max(1, Math.floor(data.quantity))
                : 1,
            customerName:
              typeof customer.name === 'string' && customer.name.trim() ? customer.name.trim() : null,
            customerPhone:
              typeof customer.phone === 'string' && customer.phone.trim() ? customer.phone.trim() : null,
            customerEmail:
              typeof customer.email === 'string' && customer.email.trim() ? customer.email.trim() : null,
            notes: typeof data.notes === 'string' && data.notes.trim() ? data.notes.trim() : null,
            createdAt: createdAtValue,
          } satisfies BookingRecord
        })
        setBookings(rows)
        setLoading(false)
      },
      error => {
        console.error('[bookings] Failed to load bookings', error)
        setErrorMessage('Unable to load bookings right now. Please try again.')
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [storeId])

  const confirmedCount = useMemo(
    () => bookings.filter(booking => booking.status.toLowerCase() === 'confirmed').length,
    [bookings],
  )

  return (
    <main className="page">
      <section className="card stack gap-4">
        <header className="stack gap-1">
          <h1>Bookings</h1>
          <p className="form__hint">
            Website bookings appear here. New booking contact details are automatically mapped into Customers when they include a phone or email.
          </p>
        </header>

        {loading && <p className="form__hint">Loading bookings…</p>}
        {!loading && errorMessage && <p className="form__error">{errorMessage}</p>}
        {!loading && !errorMessage && (
          <>
            <p className="form__hint">
              Total bookings: <strong>{bookings.length}</strong> • Confirmed: <strong>{confirmedCount}</strong>
            </p>
            {bookings.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Created</th>
                      <th>Service</th>
                      <th>Customer</th>
                      <th>Qty</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(booking => (
                      <tr key={booking.id}>
                        <td>{formatDate(booking.createdAt)}</td>
                        <td>{booking.serviceId}</td>
                        <td>
                          {[booking.customerName, booking.customerPhone, booking.customerEmail]
                            .filter(Boolean)
                            .join(' • ') || '—'}
                        </td>
                        <td>{booking.quantity}</td>
                        <td>{booking.status}</td>
                        <td>{booking.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="form__hint">No bookings yet.</p>
            )}
          </>
        )}
      </section>
    </main>
  )
}
