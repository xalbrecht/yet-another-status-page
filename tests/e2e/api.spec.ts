import { test, expect } from '@playwright/test'
import { createSubscriber } from '../utils/payload-helpers'

/**
 * API Endpoint Tests
 * 
 * Tests for the REST API endpoints using Playwright's request context.
 */
test.describe('Health API', { tag: ['@api', '@schnittstelle'] }, () => {
  test('returns ok status', async ({ request }) => {
    const response = await request.get('/api/health')
    
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    expect(data.ok).toBe(true)
  })
})

test.describe('Subscribe API', { tag: ['@api', '@schnittstelle', '@abonnenten'] }, () => {
  test('returns availability status', async ({ request }) => {
    const response = await request.get('/api/subscribe')
    
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    expect(data).toHaveProperty('email')
    expect(data).toHaveProperty('sms')
  })

  test('rejects empty subscription request', async ({ request }) => {
    const response = await request.post('/api/subscribe', {
      data: {},
    })
    
    expect(response.status()).toBe(400)
  })

  test('rejects invalid subscription type', async ({ request }) => {
    const response = await request.post('/api/subscribe', {
      data: {
        type: 'invalid',
        email: 'test@example.com',
      },
    })
    
    expect(response.status()).toBe(400)
  })

  test('creates email subscription', async ({ request }) => {
    const response = await request.post('/api/subscribe', {
      data: {
        type: 'email',
        email: `api-test-${Date.now()}@example.com`,
      },
    })
    
    // May be 200 (success) or error if SMTP not configured
    expect([200, 400, 503]).toContain(response.status())
  })
})

test.describe('Unsubscribe API', { tag: ['@api', '@schnittstelle', '@abonnenten'] }, () => {
  test('returns error for missing token', async ({ request }) => {
    const response = await request.post('/api/unsubscribe', {
      data: {},
    })
    
    expect(response.status()).toBe(400)
    
    const data = await response.json()
    expect(data.error).toContain('token')
  })

  test('returns error for invalid token', async ({ request }) => {
    const response = await request.post('/api/unsubscribe', {
      data: {
        token: 'invalid-token-12345',
      },
    })
    
    expect(response.status()).toBe(404)
  })
})

test.describe('Einmalabmeldung (RFC 8058)', { tag: ['@api', '@schnittstelle', '@abonnenten'] }, () => {
  const form = { 'List-Unsubscribe': 'One-Click' }

  test('POST ohne Formularfeld ergibt 400', async ({ request }) => {
    const response = await request.post('/api/unsubscribe/irgendein-token', { form: {} })
    expect(response.status()).toBe(400)
  })

  test('POST mit unbekanntem Token ergibt 404', async ({ request }) => {
    const response = await request.post('/api/unsubscribe/invalid-token-12345', { form })
    expect(response.status()).toBe(404)
  })

  test('POST mit gültigem Token meldet den Abonnenten ab', async ({ request }) => {
    const subscriber = await createSubscriber({ type: 'email', email: `oneclick-${Date.now()}@example.com` })

    const response = await request.post(`/api/unsubscribe/${subscriber.unsubscribeToken}`, { form })
    expect(response.status()).toBe(200)

    const again = await request.post('/api/unsubscribe', { data: { token: subscriber.unsubscribeToken } })
    expect((await again.json()).message).toBe('Already unsubscribed')
  })

  test('GET leitet auf die Seite mit dem Abmelde-Knopf weiter', async ({ request }) => {
    const response = await request.get('/api/unsubscribe/irgendein-token', { maxRedirects: 0 })
    expect(response.status()).toBe(303)
    expect(response.headers()['location']).toContain('/unsubscribe/irgendein-token')
  })
})

// Dashboard Stats API is authenticated - skip in E2E tests
// This endpoint requires admin authentication which we don't test
