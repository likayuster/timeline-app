-- This is an empty migration.-- ユーザー検索用のGINインデックス
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ユーザー名と表示名で検索するためのGINインデックス
CREATE INDEX user_username_search_idx ON "User" USING gin(username gin_trgm_ops);
CREATE INDEX user_displayname_search_idx ON "User" USING gin((COALESCE("displayName", '')) gin_trgm_ops);

-- ユーザー名と表示名を結合したフルテキスト検索インデックス
CREATE INDEX user_fulltext_search_idx ON "User" USING gin(
  to_tsvector('english', 
    username || ' ' || COALESCE("displayName", '')
  )
);

-- 投稿内容のフルテキスト検索インデックス
CREATE INDEX post_content_search_idx ON "Post" USING gin(
  to_tsvector('english', content)
);

-- コメント内容のフルテキスト検索インデックス（必要に応じて）
CREATE INDEX comment_content_search_idx ON "Comment" USING gin(
  to_tsvector('english', content)
);

-- pg_bigm拡張機能のインストール（PostgreSQLサーバーに管理者権限でインストール必要）
CREATE EXTENSION IF NOT EXISTS pg_bigm;

-- ユーザー検索用のインデックス
CREATE INDEX user_username_bigm_idx ON "User" USING gin (username gin_bigm_ops);
CREATE INDEX user_displayname_bigm_idx ON "User" USING gin (COALESCE("displayName", '') gin_bigm_ops);

-- 投稿検索用のインデックス
CREATE INDEX post_content_bigm_idx ON "Post" USING gin (content gin_bigm_ops);

-- コメント検索用のインデックス（必要に応じて）
CREATE INDEX comment_content_bigm_idx ON "Comment" USING gin (content gin_bigm_ops);