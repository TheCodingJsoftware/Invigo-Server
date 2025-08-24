#!/bin/bash
set -e

echo "🔍 Running depcheck to find unused dependencies..."
unused=$(npx depcheck --json | jq -r '.dependencies[]')

if [ -n "$unused" ]; then
  echo "🗑️ Uninstalling unused dependencies: $unused"
  npm uninstall $unused
else
  echo "✅ No unused dependencies found!"
fi

echo "⬆️ Running npm-check-updates..."
npx ncu -u

echo "🧹 Clearing node_modules and package-lock.json..."
rm -rf node_modules package-lock.json

echo "📦 Installing fresh dependencies..."
npm install

echo "✨ Upgrade complete!"
