'use client'

import { useState } from 'react'
import { t, tf } from '@/lib/i18n'
import Link from 'next/link'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

interface UnsubscribeClientProps {
  siteName: string
  status: 'active' | 'already-unsubscribed' | 'not-found'
  token: string
  subscriberType?: string
  subscriberContact?: string | null
}

export function UnsubscribeClient({
  siteName,
  status,
  token,
  subscriberType,
  subscriberContact,
}: UnsubscribeClientProps) {
  const [isUnsubscribing, setIsUnsubscribing] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)

  const handleUnsubscribe = async () => {
    setIsUnsubscribing(true)
    try {
      const response = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (response.ok) {
        setResult('success')
      } else {
        setResult('error')
      }
    } catch {
      setResult('error')
    } finally {
      setIsUnsubscribing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center">
        {status === 'not-found' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t('unsub.invalidTitle')}
            </h1>
            <p className="text-muted-foreground mb-6">
              {t('unsub.invalidText')}
            </p>
          </>
        )}

        {status === 'already-unsubscribed' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t('unsub.alreadyTitle')}
            </h1>
            <p className="text-muted-foreground mb-6">
              {tf('unsub.alreadyText', { siteName })}
            </p>
          </>
        )}

        {status === 'active' && result === null && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-status-maintenance/10 flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-status-maintenance" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t('unsub.confirmTitle')}
            </h1>
            <p className="text-muted-foreground mb-2">
              {t('unsub.confirmBefore')} {subscriberType === 'email' ? t('unsub.typeEmail') : t('unsub.typeSms')}{t('unsub.confirmMid')}{' '}
              <strong>{siteName}</strong> {t('unsub.confirmAfter')}
            </p>
            {subscriberContact && (
              <p className="text-sm text-muted-foreground mb-6">
                {subscriberType === 'email' ? t('unsub.labelEmail') : t('unsub.labelPhone')}: {subscriberContact}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleUnsubscribe}
                disabled={isUnsubscribing}
                className="w-full py-3 px-4 rounded-lg bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUnsubscribing ? t('unsub.submitting') : t('unsub.submit')}
              </button>
              <Link
                href="/"
                className="w-full py-3 px-4 rounded-lg border border-border text-foreground font-medium hover:bg-accent transition-colors"
              >
                {t('unsub.cancel')}
              </Link>
            </div>
          </>
        )}

        {result === 'success' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-status-operational/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-status-operational" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t('unsub.successTitle')}
            </h1>
            <p className="text-muted-foreground mb-6">
              {tf('unsub.successText', { siteName })}
            </p>
          </>
        )}

        {result === 'error' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t('unsub.errorTitle')}
            </h1>
            <p className="text-muted-foreground mb-6">
              {t('unsub.errorText')}
            </p>
          </>
        )}

        <Link
          href="/"
          className="text-sm text-primary hover:text-primary/80 transition-colors"
        >
          {t('unsub.back')}
        </Link>
      </div>
    </div>
  )
}
