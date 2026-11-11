'use client'

import { useState } from 'react'
import { t, tf } from '@/lib/i18n'
import Link from 'next/link'
import { CheckCircle, XCircle, MailCheck } from 'lucide-react'

interface ConfirmClientProps {
  siteName: string
  status: 'pending' | 'invalid'
  token: string
  email?: string | null
}

export function ConfirmClient({ siteName, status, token, email }: ConfirmClientProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [result, setResult] = useState<'success' | 'success-approved' | 'error' | null>(null)

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      const response = await fetch('/api/subscribe/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (response.ok) {
        const data = await response.json()
        setResult(data.approved ? 'success-approved' : 'success')
      } else {
        setResult('error')
      }
    } catch {
      setResult('error')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center">
        {status === 'invalid' && result === null && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{t('confirm.invalidTitle')}</h1>
            <p className="text-muted-foreground mb-6">{t('confirm.invalidText')}</p>
          </>
        )}

        {status === 'pending' && result === null && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <MailCheck className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{t('confirm.title')}</h1>
            <p className="text-muted-foreground mb-2">{tf('confirm.text', { siteName })}</p>
            {email && <p className="text-sm font-medium text-foreground mb-6">{email}</p>}
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="w-full py-3 px-4 mb-6 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isConfirming ? t('confirm.submitting') : t('confirm.submit')}
            </button>
          </>
        )}

        {(result === 'success' || result === 'success-approved') && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-status-operational/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-status-operational" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{t('confirm.successTitle')}</h1>
            <p className="text-muted-foreground mb-6">
              {tf(result === 'success-approved' ? 'confirm.successApprovedText' : 'confirm.successText', { siteName })}
            </p>
          </>
        )}

        {result === 'error' && (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{t('confirm.errorTitle')}</h1>
            <p className="text-muted-foreground mb-6">{t('confirm.errorText')}</p>
          </>
        )}

        <Link href="/" className="text-sm text-primary hover:text-primary/80 transition-colors">
          {t('confirm.back')}
        </Link>
      </div>
    </div>
  )
}
