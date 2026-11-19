-- Per-user saved articles for the Knowledge Base.
-- Apply after 0001_auth.sql to the production D1 database.

CREATE TABLE IF NOT EXISTS article_favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_article_favorites_user_created
  ON article_favorites(user_id, created_at DESC);
