-- Content management: pending submissions, approved additions and article revisions.
-- Apply after 0001_auth.sql and 0002_article_favorites.sql.

CREATE TABLE IF NOT EXISTS content_requests (
  id TEXT PRIMARY KEY,
  request_type TEXT NOT NULL CHECK (request_type IN ('new', 'edit')),
  article_id TEXT,
  submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  submitter_name TEXT NOT NULL,
  submitter_email TEXT,
  payload_json TEXT NOT NULL,
  original_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  external_source TEXT,
  external_response_id TEXT,
  UNIQUE (external_source, external_response_id)
);

CREATE INDEX IF NOT EXISTS idx_content_requests_status_type_created
  ON content_requests(status, request_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_requests_article
  ON content_requests(article_id, created_at DESC);

CREATE TABLE IF NOT EXISTS published_articles (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES content_requests(id) ON DELETE RESTRICT,
  article_json TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  published_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS article_overrides (
  article_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES content_requests(id) ON DELETE RESTRICT,
  article_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS article_revision_history (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES content_requests(id) ON DELETE RESTRICT,
  article_id TEXT NOT NULL,
  original_json TEXT,
  updated_json TEXT NOT NULL,
  submitted_by TEXT,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_article_revision_history_article
  ON article_revision_history(article_id, approved_at DESC);
