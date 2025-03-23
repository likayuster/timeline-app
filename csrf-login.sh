#!/bin/bash

# 1. CSRFトークンを取得し、同じセッションでログイン
CSRF_URL="http://localhost:3000/api/csrf-token"
LOGIN_URL="http://localhost:3000/auth/login"

# クッキージャーファイルを作成（curl間でクッキーを共有）
COOKIE_JAR="cookie_jar.txt"

echo "1. CSRFトークンを取得しています..."
curl -s -c "$COOKIE_JAR" "$CSRF_URL"

echo "2. クッキーファイルの内容:"
cat "$COOKIE_JAR"

# クッキーファイルからCSRFトークンを抽出
TOKEN=$(grep XSRF-TOKEN "$COOKIE_JAR" | awk '{print $7}')
echo "3. 抽出したトークン: $TOKEN"

if [ -z "$TOKEN" ]; then
  echo "エラー: トークンを抽出できませんでした。"
  exit 1
fi

echo "4. ログインリクエストを送信しています..."
curl -v -X POST "$LOGIN_URL" \
  -H "Content-Type: application/json" \
  -H "X-XSRF-TOKEN: $TOKEN" \
  -b "$COOKIE_JAR" \
  -c "$COOKIE_JAR" \
  -d '{"usernameOrEmail": "admin@example.com", "password": "Admin123!"}'

echo "5. 完了しました。"
