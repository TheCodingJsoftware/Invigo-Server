#!/usr/bin/env bash
set -euo pipefail

# Ensure Docker is installed
if ! command -v docker &>/dev/null; then
  echo "Docker is not installed."
  exit 1
fi

# Image name
IMAGE="jarebear/invigo-puppeteer"

# Timestamp version: YYYYMMDDHHMMSS
VERSION=$(date +'%Y%m%d%H%M%S')

# Build the image
docker build \
  -t "$IMAGE:$VERSION" \
  -t "$IMAGE:latest" \
  ./puppeteer

echo "✅ Local build complete: $IMAGE:$VERSION"

# Push to Docker Hub
docker push "$IMAGE:$VERSION"
docker push "$IMAGE:latest"

echo "🚀 Push complete: Docker Hub updated"
