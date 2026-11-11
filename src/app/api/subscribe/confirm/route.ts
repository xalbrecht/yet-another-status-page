import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

// Confirms the email address of a subscriber (link in the confirmation email).
// The token works once: it is removed after use.
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token : ''

    if (token.length < 10) {
      return NextResponse.json({ error: 'Invalid confirmation token' }, { status: 400 })
    }

    const result = await payload.find({
      collection: 'subscribers',
      where: {
        and: [
          { verificationToken: { equals: token } },
          { type: { equals: 'email' } },
        ],
      },
      limit: 1,
    })

    const subscriber = result.docs[0]

    if (!subscriber) {
      return NextResponse.json({ error: 'Invalid confirmation token' }, { status: 404 })
    }

    await payload.update({
      collection: 'subscribers',
      id: subscriber.id,
      data: {
        addressConfirmed: true,
        verificationToken: null,
      },
    })

    return NextResponse.json({
      success: true,
      approved: Boolean(subscriber.verified),
    })
  } catch (error) {
    console.error('Error confirming subscription:', error)
    return NextResponse.json({ error: 'Failed to confirm subscription' }, { status: 500 })
  }
}
