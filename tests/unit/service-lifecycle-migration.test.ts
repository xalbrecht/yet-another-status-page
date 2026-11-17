import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { up } from '@/migrations/20261118_100000_add_service_lifecycle'

/**
 * Die Migration gegen eine echte PostgreSQL. Läuft nur mit gesetztem `TEST_DATABASE_URL`, sonst übersprungen.
 * Alles liegt in einem eigenen Schema, das am Ende entfällt.
 */
const url = process.env.TEST_DATABASE_URL

test('Migration: Beginn ist das früheste von 01.01.2025, erstem Eintrag und Anlegedatum, nie leer', { skip: !url, timeout: 30_000 }, async () => {
  const pool = new pg.Pool({ connectionString: url, max: 1 })
  try {
    await pool.query('create schema if not exists lifecycle_test')
    await pool.query('set search_path to lifecycle_test')
    await pool.query('create table services (id serial primary key, created_at timestamptz not null)')
    await pool.query('create table service_status_events (id serial primary key, service_id integer not null, changed_at timestamptz not null)')
    // A: Anlegedatum und Eintrag nach dem 01.01.2025 -> 01.01.2025
    // B: Anlegedatum 01.05.2024, Eintrag 01.06.2024 -> 01.05.2024
    // C: ohne Eintrag, Anlegedatum 01.03.2026 -> 01.01.2025
    // D: Anlegedatum 01.03.2026, aber Eintrag schon am 10.02.2024 (nachgetragen) -> 10.02.2024
    await pool.query(`insert into services (id, created_at) values (1, '2026-03-01T10:00:00Z'), (2, '2024-05-01T10:00:00Z'), (3, '2026-03-01T10:00:00Z'), (4, '2026-03-01T10:00:00Z')`)
    await pool.query(`insert into service_status_events (service_id, changed_at) values (1, '2026-04-01T00:00:00Z'), (2, '2024-06-01T00:00:00Z'), (4, '2024-02-10T00:00:00Z')`)

    await up({ db: drizzle(pool) } as unknown as Parameters<typeof up>[0])

    const rows = (await pool.query('select id, starts_at, ends_at from services order by id')).rows
    const iso = (value: Date) => value.toISOString()
    assert.deepEqual(rows.map((row) => iso(row.starts_at)), [
      '2025-01-01T00:00:00.000Z',
      '2024-05-01T10:00:00.000Z',
      '2025-01-01T00:00:00.000Z',
      '2024-02-10T00:00:00.000Z',
    ])
    assert.ok(rows.every((row) => row.ends_at === null), 'Ende bleibt leer')
    const column = (await pool.query(`select is_nullable from information_schema.columns where table_schema = 'lifecycle_test' and table_name = 'services' and column_name = 'starts_at'`)).rows[0]
    assert.equal(column.is_nullable, 'NO')
  } finally {
    await pool.query('drop schema if exists lifecycle_test cascade').catch(() => undefined)
    await pool.end()
  }
})
