'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { useAdminText } from '@/lib/i18n/admin-client'
import { hasAnyRole, hasRole, type RoleUser } from '@/lib/roles'
import './DashboardWidgets.scss'

interface WidgetData {
  pendingNotifications: number
  pendingSubscribers: number
  scheduledNotifications: number
  emailSubscribers: number
  smsSubscribers: number
  activeIncidents: number
  upcomingMaintenances: number
  /** Konto mit Gruppenliste: Die Zahlen oben gelten nur für den Bereich, die `…Total`-Felder zählen alle Gruppen. */
  scoped?: boolean
  activeIncidentsTotal?: number
  upcomingMaintenancesTotal?: number
  pendingNotificationsTotal?: number
  scheduledNotificationsTotal?: number
}

/**
 * Zahl einer Kachel. Konten mit Gruppenliste sehen „Meine Gruppen“ und „Gesamt“ nebeneinander, alle anderen nur die Zahl.
 */
const Count: React.FC<{ own: number; total?: number; scoped?: boolean }> = ({ own, total, scoped }) => {
  const ta = useAdminText()
  if (!scoped || total === undefined) return <div className="dashboard-widget__value">{own}</div>
  return (
    <div className="dashboard-widget__pair">
      <div>
        <div className="dashboard-widget__value" data-testid="count-own">{own}</div>
        <div className="dashboard-widget__hint">{ta('My groups')}</div>
      </div>
      <div className="dashboard-widget__pair-total">
        <div className="dashboard-widget__value dashboard-widget__value--plain" data-testid="count-total">{total}</div>
        <div className="dashboard-widget__hint">{ta('Total')}</div>
      </div>
    </div>
  )
}

export const DashboardWidgets: React.FC = () => {
  const ta = useAdminText()
  const { user } = useAuth()
  const isAdmin = hasRole(user as RoleUser, 'admin')
  const canNotify = hasAnyRole(user as RoleUser, ['admin', 'servicedesk'])
  const [data, setData] = useState<WidgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard-stats')
        if (!response.ok) {
          throw new Error(ta('Failed to fetch dashboard stats'))
        }
        const stats = await response.json()
        setData(stats)
      } catch (err) {
        setError(err instanceof Error ? err.message : ta('Unknown error'))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [ta])

  if (loading) {
    return (
      <div className="dashboard-widgets">
        <div className="dashboard-widgets__loading">{ta('Loading dashboard stats...')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-widgets">
        <div className="dashboard-widgets__error">{ta('Failed to load stats:')} {error}</div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="dashboard-widgets">
      <h2 className="dashboard-widgets__title">{ta('Status Overview')}</h2>

      {isAdmin && data.pendingSubscribers > 0 && (
        <Link
          href="/admin/collections/subscribers?where[verified][not_equals]=true"
          data-testid="pending-subscribers-notice"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            borderRadius: '4px',
            border: '1px solid var(--theme-warning-500, #d97706)',
            background: 'var(--theme-warning-100, #fef3c7)',
            color: 'var(--theme-warning-800, #92400e)',
            textDecoration: 'none',
          }}
        >
          <span>{ta('{count} subscription(s) waiting for approval or confirmation').replace('{count}', String(data.pendingSubscribers))}</span>
          <strong>{ta('Review subscribers')}</strong>
        </Link>
      )}
      
      <div className="dashboard-widgets__grid">
        {/* Active Incidents */}
        <Link href="/admin/collections/incidents" className="dashboard-widget dashboard-widget--incidents">
          <div className="dashboard-widget__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="dashboard-widget__content">
            <div className="dashboard-widget__label">{ta('Active Incidents')}</div>
            <Count own={data.activeIncidents} total={data.activeIncidentsTotal} scoped={data.scoped} />
          </div>
        </Link>

        {/* Upcoming Maintenances */}
        <Link href="/admin/collections/maintenances" className="dashboard-widget dashboard-widget--maintenances">
          <div className="dashboard-widget__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
          </div>
          <div className="dashboard-widget__content">
            <div className="dashboard-widget__label">{ta('Upcoming Maintenances')}</div>
            <Count own={data.upcomingMaintenances} total={data.upcomingMaintenancesTotal} scoped={data.scoped} />
          </div>
        </Link>

        {canNotify && (
          <>
        {/* Pending Notifications */}
        <Link href="/admin/collections/notifications?where[status][equals]=draft" className="dashboard-widget dashboard-widget--pending">
          <div className="dashboard-widget__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div className="dashboard-widget__content">
            <div className="dashboard-widget__label">{ta('Notification drafts')}</div>
            <Count own={data.pendingNotifications} total={data.pendingNotificationsTotal} scoped={data.scoped} />
          </div>
        </Link>

        {/* Scheduled Notifications */}
        <Link href="/admin/collections/notifications?where[status][equals]=scheduled" className="dashboard-widget dashboard-widget--scheduled">
          <div className="dashboard-widget__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="dashboard-widget__content">
            <div className="dashboard-widget__label">{ta('Scheduled notifications')}</div>
            <Count own={data.scheduledNotifications} total={data.scheduledNotificationsTotal} scoped={data.scoped} />
          </div>
        </Link>
          </>
        )}

        {isAdmin && (
          <>
        {/* Email Subscribers */}
        <Link href="/admin/collections/subscribers?where[type][equals]=email" className="dashboard-widget dashboard-widget--email">
          <div className="dashboard-widget__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div className="dashboard-widget__content">
            <div className="dashboard-widget__value">{data.emailSubscribers}</div>
            <div className="dashboard-widget__label">{ta('Email Subscribers')}</div>
          </div>
        </Link>

        {/* SMS Subscribers */}
        <Link href="/admin/collections/subscribers?where[type][equals]=sms" className="dashboard-widget dashboard-widget--sms">
          <div className="dashboard-widget__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <div className="dashboard-widget__content">
            <div className="dashboard-widget__value">{data.smsSubscribers}</div>
            <div className="dashboard-widget__label">{ta('SMS Subscribers')}</div>
          </div>
        </Link>
          </>
        )}
      </div>
    </div>
  )
}
