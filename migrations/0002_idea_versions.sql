-- Versionshistorik för idéer : varje « gör billigare » och återställning skapar en ny version.

CREATE TABLE idea_versions (
  idea_id TEXT NOT NULL REFERENCES prototype_ideas (id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('initial', 'cheaper', 'restore')),
  analysis TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  PRIMARY KEY (idea_id, version)
);

-- Befintliga idéer får sin nuvarande analys som version 1.
INSERT INTO idea_versions (idea_id, version, source, analysis, meta, created_at)
SELECT id, 1, 'initial', analysis, '{}', created_at FROM prototype_ideas;
