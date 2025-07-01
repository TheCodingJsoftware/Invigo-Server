#!/usr/bin/env bash
set -euo pipefail

# Ensure Docker is installed
if ! command -v docker &>/dev/null; then
  echo "Docker is not installed. Install it with: sudo pacman -S docker"
  exit 1
fi

# Generate timestamp version: YYYYMMDDHHMMSS
VERSION=$(date +'%Y%m%d%H%M%S')

# Build the image locally
docker build \
  -t jarebear/invigo-server:"$VERSION" \
  -t jarebear/invigo-server:latest \
  .

echo "✅ Local build complete: jarebear/invigo-server:$VERSION"

# Push to Docker Hub
docker push jarebear/invigo-server:"$VERSION"
docker push jarebear/invigo-server:latest

echo "🚀 Push complete: Docker Hub updated"
