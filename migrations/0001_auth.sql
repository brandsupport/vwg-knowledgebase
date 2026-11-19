PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended')),
 must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1)),
 created_at INTEGER NOT NULL,
 approved_at INTEGER,
 approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 last_login_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_status_created ON users(status,created_at);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role,status);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_throttles (
 key TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL DEFAULT 0,
 window_started_at INTEGER NOT NULL
);