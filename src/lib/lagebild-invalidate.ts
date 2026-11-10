import { revalidateTag } from 'next/cache'
import { LAGEBILD_CACHE_TAG } from '@/lib/lagebild'

/**
 * Verwirft das zwischengespeicherte Lagebild (siehe `lagebild-cache.ts`). Die Hooks der Collections rufen das auf.
 * Eigenes Modul ohne Payload-Instanz, damit die Collections keinen Zirkelbezug zur Konfiguration bekommen.
 * Außerhalb einer Anfrage von Next.js (Skripte, Migrationen) gibt es keinen Zwischenspeicher zu leeren,
 * der Aufruf wird dann ignoriert.
 */
export function invalidateLagebild(): void {
  try {
    revalidateTag(LAGEBILD_CACHE_TAG, { expire: 0 })
  } catch {
    // kein Next.js-Kontext
  }
}
