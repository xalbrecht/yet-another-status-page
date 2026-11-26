import { lagebildMemoryCache } from '@/lib/lagebild-memory'

/**
 * Verwirft das zwischengespeicherte Lagebild (siehe `lagebild-cache.ts`). Die Hooks der Collections rufen das auf.
 */
export function invalidateLagebild(): void {
  lagebildMemoryCache().clear()
}
