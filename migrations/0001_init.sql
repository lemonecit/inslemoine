-- Adminverktyget för prototyper (D1). Körs med: npx wrangler d1 migrations apply DB --local / --remote

CREATE TABLE existing_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  iso_code TEXT NOT NULL DEFAULT '',
  iso_class TEXT,
  manufacturer TEXT NOT NULL DEFAULT '',
  price_min_eur REAL,
  price_max_eur REAL,
  price_note TEXT NOT NULL DEFAULT '',
  function TEXT NOT NULL DEFAULT '',
  target_group TEXT NOT NULL DEFAULT '',
  limitations TEXT NOT NULL DEFAULT '[]',
  source_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_products_iso_class ON existing_products (iso_class);
CREATE INDEX idx_products_updated ON existing_products (updated_at);

CREATE TABLE prototype_ideas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'prioritized', 'in_development', 'archived')),
  approach TEXT NOT NULL,
  iso_class TEXT,
  grant_fit INTEGER NOT NULL CHECK (grant_fit BETWEEN 1 AND 5),
  buildability INTEGER NOT NULL CHECK (buildability BETWEEN 1 AND 5),
  next_sprint INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  analysis TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_ideas_status ON prototype_ideas (status);
CREATE INDEX idx_ideas_iso_class ON prototype_ideas (iso_class);

-- En idé kan bygga på flera befintliga produkter.
CREATE TABLE idea_products (
  idea_id TEXT NOT NULL REFERENCES prototype_ideas (id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES existing_products (id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, product_id)
);

CREATE INDEX idx_idea_products_product ON idea_products (product_id);
