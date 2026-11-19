-- Add a persistent, selectable profile avatar for each account.
ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT '👤'
  CHECK (avatar IN ('👤','🦁','🐼','🦊','🐺','🐸','🐧','🐯','🐨','🦉','🐙','🐬','🦄'));
