import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unsubscribeByToken } from '@/lib/unsubscribe'

// Einmalabmeldung nach RFC 8058: Das Mailprogramm sendet ein POST mit dem Formularfeld
// `List-Unsubscribe=One-Click` an die Adresse aus dem Kopf `List-Unsubscribe`.
// Die Seite `/unsubscribe/<token>` kann kein POST annehmen (Seite und Route dürfen in
// Next.js nicht im selben Ordner liegen), deshalb zeigt der Kopf auf diese Adresse.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const form = await request.formData().catch(() => null)
    if (form?.get('List-Unsubscribe') !== 'One-Click') {
      return NextResponse.json({ error: 'Expected List-Unsubscribe=One-Click' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const result = await unsubscribeByToken(payload, token)
    if (result === 'not-found') {
      return NextResponse.json({ error: 'Invalid unsubscribe token' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing one-click unsubscribe:', error)
    return NextResponse.json({ error: 'Failed to process unsubscribe request' }, { status: 500 })
  }
}

// Mailprogramme ohne Einmalabmeldung öffnen die Adresse im Browser: weiter zur Seite mit Knopf.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return NextResponse.redirect(new URL(`/unsubscribe/${encodeURIComponent(token)}`, request.url), 303)
}
