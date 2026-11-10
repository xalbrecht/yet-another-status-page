import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { getSettings } from '@/lib/payload'
import './(frontend)/globals.css'
import { Header } from '@/components/status/Header'
import { Footer } from '@/components/status/Footer'
import { ThemeProvider } from '@/components/theme-provider'
import { inter } from '@/lib/fonts'
import { getMediaUrl } from '@/lib/utils'
import { lang, t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function NotFound() {
  let siteName = 'Status'
  let footerText: unknown = null
  let timezone: string | undefined
  let logoLightUrl: string | undefined
  let logoDarkUrl: string | undefined

  try {
    const settings = await getSettings()

    siteName = settings.siteName || 'Status'
    footerText = settings.footerText
    timezone = settings.timezone ?? undefined
    logoLightUrl = getMediaUrl(settings.logoLight)
    logoDarkUrl = getMediaUrl(settings.logoDark)
  } catch {
    // Use defaults if settings can't be fetched
  }

  return (
    <html lang={lang} className={inter.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex min-h-screen flex-col">
            <Header
              siteName={siteName}
              logoLightUrl={logoLightUrl}
              logoDarkUrl={logoDarkUrl}
            />

            <main className="flex flex-1 items-center justify-center px-4">
              <div className="text-center">
                <div className="mb-6 flex justify-center">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-destructive/10">
                    <AlertCircle className="h-14 w-14 text-destructive" />
                  </div>
                </div>

                <h1 className="mb-2 text-6xl font-bold text-foreground">404</h1>
                <p className="mb-2 text-xl font-medium text-foreground">{t('notFound.title')}</p>
                <p className="mb-8 text-muted-foreground">
                  {t('notFound.text')}
                </p>

                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {t('nav.backToStatusPage')}
                </Link>
              </div>
            </main>

            <Footer footerText={footerText} timezone={timezone} />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
