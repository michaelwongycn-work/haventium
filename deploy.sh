#!/bin/bash
# Run this locally to build, package, and upload the app to your server.
set -e

# ── Config ────────────────────────────────────────────────────────────────────
SERVER_USER="root"
SERVER_IP=""          # e.g. 123.45.67.89
SERVER_DIR="/opt/haventium"
IMAGE_NAME="haventium_app"
IMAGE_TAG="latest"
TAR_FILE="/tmp/haventium_app.tar.gz"
# ─────────────────────────────────────────────────────────────────────────────

if [ -z "$SERVER_IP" ]; then
  read -p "Server IP: " SERVER_IP
fi

echo "==> Building Docker image..."
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo "==> Saving image to tar (this may take a minute)..."
docker save "${IMAGE_NAME}:${IMAGE_TAG}" | gzip > "$TAR_FILE"
echo "    Image size: $(du -sh "$TAR_FILE" | cut -f1)"

echo "==> Uploading image to server..."
scp "$TAR_FILE" "${SERVER_USER}@${SERVER_IP}:/tmp/haventium_app.tar.gz"

echo "==> Uploading nginx config..."
scp -r nginx "${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/nginx"

echo "==> Loading image and restarting app on server..."
ssh "${SERVER_USER}@${SERVER_IP}" bash << EOF
  set -e
  echo "  -> Loading image..."
  docker load < /tmp/haventium_app.tar.gz
  rm /tmp/haventium_app.tar.gz

  echo "  -> Restarting app container..."
  cd ${SERVER_DIR}
  docker compose up -d --no-deps --no-build app

  echo "  -> Pruning old images..."
  docker image prune -f
EOF

rm "$TAR_FILE"

echo ""
echo "Done. App is live at your server."
