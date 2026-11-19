-- Account recovery requests, admin notifications and extensible avatar preferences.
-- Apply after 0005_user_avatars.sql.

CREATE TABLE IF NOT EXISTS user_avatar_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_notifications (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_url TEXT NOT NULL DEFAULT '/admin',
  created_at INTEGER NOT NULL,
  read_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_created
  ON admin_notifications(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_unread
  ON admin_notifications(admin_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','cancelled')),
  resolved_at INTEGER,
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_pending_user
  ON password_reset_requests(user_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_password_reset_status_created
  ON password_reset_requests(status, created_at DESC);
