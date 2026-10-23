/**
 * SQLite schema (portable to PostgreSQL: no SQLite-only types, enums as CHECK constraints).
 *
 *  - `documents.fields` holds what was read off each document (made-up data in this demo;
 *    OCR / DigiLocker in production) so the rules engine and AI work from structured facts.
 *  - `ai_analyses` caches one AI analysis per application, keyed by a hash of its inputs, so
 *    reopening an application costs nothing and any change to the file invalidates it.
 *  - The decision columns record what the AI suggested at the moment the officer decided,
 *    so agreement/override rates can be measured. The officer's decision is always final.
 *  - `events` is an append-only audit trail.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS officers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  designation   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id                  TEXT PRIMARY KEY,
  applicant_name      TEXT NOT NULL,
  applicant_name_en   TEXT NOT NULL,
  father_name         TEXT NOT NULL,
  gender              TEXT NOT NULL CHECK (gender IN ('F', 'M', 'O')),
  dob                 TEXT NOT NULL,
  mobile_masked       TEXT NOT NULL,
  aadhaar_last4       TEXT NOT NULL,
  village             TEXT NOT NULL,
  district            TEXT NOT NULL,
  category            TEXT NOT NULL CHECK (category IN ('SC', 'ST', 'OBC')),
  caste               TEXT NOT NULL,
  annual_income       INTEGER,
  purpose             TEXT NOT NULL,
  purpose_deadline    TEXT,
  submitted_at        TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'returned', 'approved', 'rejected')),
  decided_at          TEXT,
  decided_by          INTEGER REFERENCES officers(id),
  decision_reason     TEXT,
  ai_suggestion       TEXT CHECK (ai_suggestion IN ('approve', 'reject', 'return')),
  certificate_no      TEXT
);
CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status, submitted_at);

CREATE TABLE IF NOT EXISTS documents (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  fields          TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_docs_app ON documents(application_id);

CREATE TABLE IF NOT EXISTS ai_analyses (
  application_id  TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  input_hash      TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('ai', 'template')),
  payload         TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  officer_id      INTEGER REFERENCES officers(id),
  type            TEXT NOT NULL,
  detail          TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_events_app ON events(application_id);

CREATE TABLE IF NOT EXISTS ai_usage (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id    TEXT,
  model             TEXT NOT NULL,
  success           INTEGER NOT NULL,
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  cached_tokens     INTEGER,
  latency_ms        INTEGER,
  error             TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`;
