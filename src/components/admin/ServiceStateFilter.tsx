'use client'

import React from 'react'
import { useListQuery } from '@payloadcms/ui'
import { applyServiceState, detectServiceState, type ServiceState } from '@/lib/service-lifecycle'
import { ServiceStateFilterView } from './ServiceStateFilterView'
import './ServiceStateFilter.scss'

/**
 * Schnellwahl über der Dienstliste: Alle, Aktiv, Beendet, Noch nicht begonnen. Ein Klick setzt die Bedingung auf Beginn und
 * Ende in die Abfrage der Liste, andere Filter und die Suche bleiben erhalten. Der Zeitpunkt „jetzt“ ist der des Klicks.
 */
export const ServiceStateFilter: React.FC = () => {
  const { query, handleWhereChange } = useListQuery()
  const current = detectServiceState(query.where)
  const choose = (state: ServiceState | null) => {
    void handleWhereChange?.(applyServiceState(query.where, state, Date.now()) ?? {})
  }
  return <ServiceStateFilterView current={current} onChoose={choose} />
}
