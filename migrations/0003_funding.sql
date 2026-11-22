-- Finansiering : utlysningar (bidrag), matchning mot idéer, checklista, ansökningsutkast och inställningar.

CREATE TABLE funding_calls (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  funder TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('foundation', 'eu', 'state', 'company', 'other')),
  url TEXT NOT NULL DEFAULT '',
  deadline TEXT,
  amount_min_eur REAL,
  amount_max_eur REAL,
  eligibility TEXT NOT NULL DEFAULT '',
  requirements TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'interested', 'preparing', 'submitted', 'granted', 'rejected', 'dropped')),
  next_step TEXT NOT NULL DEFAULT '',
  next_step_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  source_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_calls_deadline ON funding_calls (deadline);
CREATE INDEX idx_calls_status ON funding_calls (status);

CREATE TABLE call_matches (
  call_id TEXT NOT NULL REFERENCES funding_calls (id) ON DELETE CASCADE,
  idea_id TEXT NOT NULL REFERENCES prototype_ideas (id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  rationale TEXT NOT NULL DEFAULT '',
  gaps TEXT NOT NULL DEFAULT '[]',
  model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (call_id, idea_id)
);

CREATE TABLE call_checklist (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES funding_calls (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_checklist_call ON call_checklist (call_id);

CREATE TABLE call_drafts (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES funding_calls (id) ON DELETE CASCADE,
  idea_id TEXT REFERENCES prototype_ideas (id) ON DELETE SET NULL,
  language TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_drafts_call ON call_drafts (call_id);

CREATE TABLE admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
