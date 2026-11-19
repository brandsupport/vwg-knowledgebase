-- Article recycle bin: reversible removal and administrator-only permanent deletion.
-- Apply after migrations 0001, 0002 and 0003.
CREATE TABLE IF NOT EXISTS article_recycle_bin (
  article_id TEXT PRIMARY KEY,
  article_json TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'knowledge-base',
  deleted_at INTEGER NOT NULL,
  deleted_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_article_recycle_bin_deleted_at
  ON article_recycle_bin(deleted_at DESC);
