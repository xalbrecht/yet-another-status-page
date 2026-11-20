import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildChoiceRows } from '@/lib/service-choices'
import { ServiceChoicesView } from '@/components/admin/ServiceChoicesView'
import { withAdminText } from './i18n-helpers'

// Issue #210: Zeilen des Feldes „Dienste nach der Behebung“ und ihre Darstellung

test('buildChoiceRows: Dienst ohne gemerkten Zustand erzeugt keine Zeile', () => {
  assert.deepEqual(buildChoiceRows([1, 2], { 1: 'degraded', 2: null }, []), [{ service: 1, restore: true }])
})

test('buildChoiceRows: neue Zeile ist angehakt, eine getroffene Wahl bleibt', () => {
  const rows = buildChoiceRows([1, 2], { 1: 'degraded', 2: 'major' }, [{ service: 2, restore: false }])
  assert.deepEqual(rows, [
    { service: 1, restore: true },
    { service: 2, restore: false },
  ])
})

test('buildChoiceRows: Dienst, der nicht mehr zum Vorfall gehört, fällt weg; IDs als Objekt und Dopplungen', () => {
  const rows = buildChoiceRows([{ id: 1 }, 1], { 1: 'degraded', 3: 'major' }, [{ service: { id: 3 }, restore: false }])
  assert.deepEqual(rows, [{ service: 1, restore: true }])
})

test('Ansicht: nichts ohne Dienste', () => {
  assert.equal(renderToStaticMarkup(withAdminText(<ServiceChoicesView items={[]} onChange={() => {}} />)), '')
})

test('Ansicht: Text mit Zustand, vorbelegter Haken, Hinweis', () => {
  const html = renderToStaticMarkup(
    withAdminText(
      <ServiceChoicesView
        items={[
          { id: 1, name: 'Mailversand', remembered: 'degraded', restore: true },
          { id: 2, name: 'Dateiablage', remembered: 'major', restore: false },
        ]}
        onChange={() => {}}
      />,
    ),
  )
  assert.match(html, /data-testid="service-choices"/)
  assert.match(html, /Dienste nach der Behebung/)
  assert.match(html, /Mailversand/)
  assert.match(html, /Vor dem Vorfall war der Dienst im Zustand „Eingeschränkt“\. Zu diesem Zustand zurückkehren\?/)
  assert.match(html, /Vor dem Vorfall war der Dienst im Zustand „Schwerer Ausfall“/)
  assert.equal((html.match(/checked=""/g) ?? []).length, 1)
  assert.match(html, /Ohne Haken wird der Dienst auf „Betriebsbereit“ gesetzt\./)
})
