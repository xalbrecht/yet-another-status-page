'use client'

import React, { useState } from 'react'
import { useDocumentInfo, useField } from '@payloadcms/ui'
import { ta } from '@/lib/i18n/admin'
import './SendNotificationButton.scss'

export const SendNotificationCollectionButton: React.FC = () => {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const { id } = useDocumentInfo()
  const statusField = useField<string>({ path: 'status' })
  const channelField = useField<string>({ path: 'channel' })
  const subjectField = useField<string>({ path: 'subject' })
  const emailBodyField = useField<string>({ path: 'emailBody' })
  const smsBodyField = useField<string>({ path: 'smsBody' })

  const errorMessageField = useField<string>({ path: 'errorMessage' })

  const status = statusField.value
  const channel = channelField.value
  const subject = subjectField.value
  const emailBody = emailBodyField.value
  const smsBody = smsBodyField.value
  const savedError = errorMessageField.value

  const isSent = status === 'sent'
  const isFailed = status === 'failed'
  const isDraft = status === 'draft'

  // Validate that we have content to send
  const hasEmailContent = channel !== 'sms' && subject && emailBody
  const hasSmsContent = channel !== 'email' && smsBody
  const hasContent = hasEmailContent || hasSmsContent

  const handleSend = async () => {
    if (!id || (!isDraft && !isFailed)) return

    setSending(true)
    setResult(null)

    try {
      const response = await fetch('/api/notifications/send-from-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setResult({
          success: true,
          message: ta('Sent to {count} subscriber(s)').replace('{count}', String(data.totalRecipients)),
        })
        // Reload the page to reflect the updated status
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setResult({
          success: false,
          message: data.error || ta('Failed to send notification'),
        })
      }
    } catch (_error) {
      setResult({
        success: false,
        message: ta('Network error - please try again'),
      })
    } finally {
      setSending(false)
    }
  }

  if (!id) {
    return (
      <div className="send-notification-button">
        <div className="send-notification-button__info">
          {ta('Save the notification first before sending.')}
        </div>
      </div>
    )
  }

  if (isSent) {
    return (
      <div className="send-notification-button">
        <div className="send-notification-button__sent">
          ✓ {ta('Notification sent successfully')}
        </div>
      </div>
    )
  }

  return (
    <div className="send-notification-button">
      {/* Show saved error from previous failed attempt */}
      {isFailed && savedError && (
        <div className="send-notification-button__result send-notification-button__result--error">
          <strong>{ta('Send failed:')}</strong> {savedError}
        </div>
      )}

      {!hasContent && (isDraft || isFailed) && (
        <div className="send-notification-button__warning">
          {ta('Add {content} before sending.').replace('{content}', channel === 'email' ? ta('subject and email body') : channel === 'sms' ? ta('SMS message') : ta('message content'))}
        </div>
      )}

      {result && (
        <div className={`send-notification-button__result ${result.success ? 'send-notification-button__result--success' : 'send-notification-button__result--error'}`}>
          {result.message}
        </div>
      )}

      <button
        type="button"
        className="send-notification-button__button"
        onClick={handleSend}
        disabled={sending || (!isDraft && !isFailed) || !hasContent}
      >
        {sending ? (
          <>
            <span className="send-notification-button__spinner" />
            {ta('Sending...')}
          </>
        ) : (
          <>
            <svg className="send-notification-button__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
            {isFailed ? ta('Retry Send') : ta('Send Notification Now')}
          </>
        )}
      </button>
    </div>
  )
}
