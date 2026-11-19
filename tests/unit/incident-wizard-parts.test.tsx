import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ReactElement } from 'react'
import { renderToStaticMarkup as renderPlain } from 'react-dom/server'
import { withAdminText } from './i18n-helpers'
import {
  DoneView,
  ImpactStep,
  PreviewView,
  ServicesStep,
  Step,
  TemplateStep,
  TextsStep,
  type WizardGroup,
  type WizardTemplate,
} from '@/components/admin/incident-wizard/IncidentWizardParts'
import { PeriodStep } from '@/components/admin/incident-wizard/MaintenanceWizardParts'

const render = (node: ReactElement) => renderPlain(withAdminText(node))
const noop = () => {}

const group: WizardGroup = {
  id: 1,
  name: 'Kommunikation',
  services: [
    { id: 11, name: 'E-Mail', status: 'operational', openIncident: false },
    { id: 12, name: 'Webmail', status: 'degraded', openIncident: true },
    { id: 13, name: 'Kalender', status: 'operational', openIncident: false },
  ],
}
const services = (ids: number[]) => group.services.filter((service) => ids.includes(service.id))

test('ServicesStep: jeder Dienst mit Zustand, ein Dienst mit offener Störung trägt den Hinweis', () => {
  const markup = render(<ServicesStep group={group} serviceIds={[11]} naming="list" onToggle={noop} onToggleAll={noop} onNaming={noop} listText="" />)
  for (const name of ['E-Mail', 'Webmail', 'Kalender']) assert.ok(markup.includes(name), name)
  assert.equal(markup.split('iw-chip--open').length - 1, 1, 'genau ein Hinweis „offene Störung“')
  assert.ok(/Eingeschränkt|Degraded Performance/.test(markup))
  assert.ok(/Betriebsbereit|Operational/.test(markup))
})

test('ServicesStep: die Wahl der Namensform erscheint nur, wenn alle Dienste der Gruppe gewählt sind', () => {
  const some = render(<ServicesStep group={group} serviceIds={[11, 12]} naming="list" onToggle={noop} onToggleAll={noop} onNaming={noop} listText="" />)
  assert.ok(!some.includes('data-testid="naming"'))
  const all = render(<ServicesStep group={group} serviceIds={[11, 12, 13]} naming="group" onToggle={noop} onToggleAll={noop} onNaming={noop} listText="E-Mail, Webmail und Kalender" />)
  assert.ok(all.includes('data-testid="naming"'))
  assert.ok(all.includes('E-Mail, Webmail und Kalender'), 'die Aufzählung steht in der Beschriftung')
  assert.ok(all.includes('Kommunikation'), 'der Gruppenname steht in der zweiten Form')
  assert.match(all, /<input[^>]*name="iw-naming"[^>]*checked=""[^>]*value="group"/)
  assert.ok(!/<input[^>]*value="list"[^>]*checked/.test(all), 'die andere Form ist nicht gewählt')
})

test('ServicesStep: eine Gruppe mit einem Dienst bietet keine Wahl der Namensform an', () => {
  const single: WizardGroup = { id: 2, name: 'Eins', services: [group.services[0]] }
  const markup = render(<ServicesStep group={single} serviceIds={[11]} naming="list" onToggle={noop} onToggleAll={noop} onNaming={noop} listText="E-Mail" />)
  assert.ok(!markup.includes('data-testid="naming"'))
})

const templates: WizardTemplate[] = [
  { id: 7, name: 'Wird untersucht: Teilweiser Ausfall', impact: 'partial', title: 'T', body: 'B', smsBody: null, ntfyBody: null },
  { id: 8, name: 'Wird untersucht: Analyse läuft', impact: null, title: 'T', body: 'B', smsBody: null, ntfyBody: null },
]

test('TemplateStep: alle Vorlagen, „Ohne Vorlage“ und die Auswirkung der Vorlage als Hinweis', () => {
  const markup = render(<TemplateStep templates={templates} choice="7" onChoose={noop} />)
  assert.ok(markup.includes('Wird untersucht: Teilweiser Ausfall') && markup.includes('Wird untersucht: Analyse läuft'))
  assert.ok(/Ohne Vorlage|Without a template/.test(markup))
  assert.equal(markup.split('iw-chip').length - 1, 1, 'nur die Vorlage mit Auswirkung trägt einen Hinweis')
  assert.match(markup, /data-testid="template-7"[^>]*checked/)
  assert.ok(!/data-testid="template-8"[^>]*checked/.test(markup))
})

test('TemplateStep: ohne Vorlagen steht ein Hinweis, „Ohne Vorlage“ bleibt wählbar', () => {
  const markup = render(<TemplateStep templates={[]} choice={null} onChoose={noop} />)
  assert.ok(/Es gibt noch keine Vorlagen|There are no templates/.test(markup))
  assert.ok(markup.includes('data-testid="template-none"'))
})

test('ImpactStep: drei Stufen, die gewählte ist angekreuzt, der Hinweis nennt die Herkunft', () => {
  const preset = render(<ImpactStep impact="partial" presetFromTemplate onChoose={noop} />)
  assert.match(preset, /data-testid="impact-partial"[^>]*checked/)
  assert.ok(/Von der Vorlage vorbelegt|Preset by the template/.test(preset))
  const none = render(<ImpactStep impact={null} presetFromTemplate={false} onChoose={noop} />)
  assert.ok(!/data-testid="impact-[a-z]+"[^>]*checked/.test(none))
  assert.ok(/bitte wählen|please choose/.test(none))
})

test('TextsStep: SMS- und ntfy-Zähler nennen die Grenzen und markieren Überlänge', () => {
  const ok = render(<TextsStep texts={{ title: 'T', body: 'B', smsBody: 'x'.repeat(10), ntfyBody: '' }} tab="sms" onTab={noop} onChange={noop} />)
  assert.ok(/10 \/ 320/.test(ok))
  assert.ok(!ok.includes('iw-count--over'))
  const over = render(<TextsStep texts={{ title: 'T', body: 'B', smsBody: 'x'.repeat(321), ntfyBody: '' }} tab="sms" onTab={noop} onChange={noop} />)
  assert.ok(over.includes('iw-count--over'))
  assert.ok(/zu lang|too long/.test(over))
  const ntfy = render(<TextsStep texts={{ title: 'T', body: 'B', smsBody: '', ntfyBody: 'abc' }} tab="ntfy" onTab={noop} onChange={noop} />)
  assert.ok(/3 \/ 500/.test(ntfy))
})

test('PreviewView: Karte mit Titel, Text und Diensten, Folgen mit bisherigem und neuem Zustand, Entwurf mit drei Texten', () => {
  const markup = render(
    <PreviewView
      texts={{ title: 'Teilweiser Ausfall: E-Mail und Webmail', body: 'Zeile 1\nZeile 2 {{link}}', smsBody: 'SMS {{link}}', ntfyBody: 'ntfy' }}
      impact="partial"
      services={services([11, 12])}
      onBack={noop}
      onPublish={noop}
      busy={false}
      error={null}
    />,
  )
  assert.ok(markup.includes('Teilweiser Ausfall: E-Mail und Webmail'))
  assert.equal(markup.split('<p>').length - 1, 2, 'je Zeile des Textes ein Absatz')
  assert.ok(markup.includes('{{link}}'), 'der Platzhalter bleibt bis zum Veröffentlichen stehen')
  assert.ok(/E-Mail: (Betriebsbereit|Operational) →/.test(markup.replace(/<[^>]+>/g, '')))
  assert.ok(/Webmail: (Eingeschränkt|Degraded Performance) →/.test(markup.replace(/<[^>]+>/g, '')))
  assert.equal(markup.split('<details').length - 1, 3, 'E-Mail, SMS und ntfy')
  assert.ok(markup.includes('iw-pubcard--partial'))
})

test('PreviewView: Titel und Texte werden maskiert, ein Fehler und die Sperre bei laufender Anfrage erscheinen', () => {
  const markup = render(
    <PreviewView texts={{ title: '<script>alert(1)</script>', body: '<b>x</b>', smsBody: '', ntfyBody: '' }} impact="major" services={services([11])} onBack={noop} onPublish={noop} busy error="Fehlertext" />,
  )
  assert.ok(!markup.includes('<script>'))
  assert.ok(markup.includes('&lt;script&gt;'))
  assert.ok(markup.includes('Fehlertext'))
  assert.match(markup, /data-testid="publish"[^>]*disabled/)
  assert.ok(/keiner|none/.test(markup), 'ohne SMS-Text steht der Hinweis auf den allgemeinen Text')
})

test('DoneView: Verweise auf die Störung, den Entwurf und die Liste', () => {
  const markup = render(<DoneView title="Titel" impact="partial" services={services([11, 12])} incidentUrl="/admin/collections/incidents/5" draftsUrl="/admin/collections/notifications?where[relatedIncident][equals]=5" listUrl="/admin/collections/incidents" onAgain={noop} />)
  assert.ok(markup.includes('href="/admin/collections/incidents/5"'))
  assert.ok(markup.includes('relatedIncident'))
  assert.ok(markup.includes('href="/admin/collections/incidents"'))
  assert.ok(markup.includes('E-Mail, Webmail'))
})

test('Step: ein gesperrter Schritt trägt die Klasse, ein erledigter ebenfalls', () => {
  assert.ok(render(<Step number={3} title="T" locked>x</Step>).includes('iw-step--locked'))
  assert.ok(render(<Step number={3} title="T" done>x</Step>).includes('iw-step--done'))
})

test('PeriodStep: Kontrollkästchen „Auswirkung auf den Dienst“ zeigt den Zustand an', () => {
  const props = {
    timeZone: 'Europe/Berlin', maintenanceKind: 'sla', onMaintenanceKind: noop, start: '', end: '', onStart: noop, onEnd: noop,
    startInPast: false, endBeforeStart: false, templateNeedsEnd: false, onAffectsService: noop,
  }
  const off = render(<PeriodStep {...props} affectsService={false} />)
  assert.match(off, /data-testid="affects-service"/)
  assert.doesNotMatch(off, /data-testid="affects-service"[^>]*checked/)
  const on = render(<PeriodStep {...props} affectsService />)
  assert.match(on, /data-testid="affects-service"[^>]*checked/)
})
