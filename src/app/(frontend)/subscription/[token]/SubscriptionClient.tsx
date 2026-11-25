'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, XCircle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/client'
import { GroupChoice, isGroupChoiceValid, type GroupChoiceValue, type GroupOption } from '@/components/status/GroupChoice'

interface SubscriptionClientProps {
  siteName: string
  status: 'active' | 'inactive' | 'not-found'
  token: string
  subscriberContact?: string | null
  groups?: GroupOption[]
  initialChoice?: GroupChoiceValue
}

/** Seite „Auswahl ändern“: Abonnenten wählen per Token-Link aus der Mail ihre Dienstgruppen. */
export function SubscriptionClient({ siteName, status, token, subscriberContact, groups = [], initialChoice }: SubscriptionClientProps) {
  const { t, tf } = useTranslation()
  const [choice, setChoice] = useState<GroupChoiceValue>(initialChoice ?? { allGroups: true, groups: [] })
  const [query, setQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/subscription/${encodeURIComponent(token)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allGroups: choice.allGroups, groups: choice.allGroups ? [] : choice.groups }),
      })
      setResult(response.ok ? 'success' : 'error')
    } catch {
      setResult('error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-xl border border-border p-8">
        {status === 'not-found' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{t('subpref.invalidTitle')}</h1>
            <p className="text-muted-foreground mb-6">{t('subpref.invalidText')}</p>
          </div>
        )}

        {status === 'inactive' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{t('subpref.inactiveTitle')}</h1>
            <p className="text-muted-foreground mb-6">{tf('subpref.inactiveText', { siteName })}</p>
          </div>
        )}

        {status === 'active' && result !== 'success' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-foreground">{t('subpref.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('subpref.intro')}</p>
            {subscriberContact && <p className="text-xs text-muted-foreground">{subscriberContact}</p>}
            <GroupChoice groups={groups} value={choice} onChange={setChoice} query={query} onQueryChange={setQuery} idPrefix="subscription-groups" />
            {result === 'error' && (
              <p role="alert" className="text-sm text-destructive">
                {t('subpref.errorText')}
              </p>
            )}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving || !isGroupChoiceValid(choice)}
                className="py-2.5 px-5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? t('subpref.saving') : t('subpref.save')}
              </button>
            </div>
          </div>
        )}

        {status === 'active' && result === 'success' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-status-operational/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-status-operational" />
            </div>
            <h1 role="status" className="text-2xl font-bold text-foreground mb-2">{t('subpref.savedTitle')}</h1>
            <p className="text-muted-foreground mb-6">{t('subpref.savedText')}</p>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-primary hover:text-primary/80 transition-colors">
            {t('unsub.back')}
          </Link>
        </div>
      </div>
    </div>
  )
}
