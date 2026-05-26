#!/bin/bash
# ============================================================
# Televix — Deploy script para el VPS
# Sincroniza con GitHub, rebuilda y reinicia servicios.
# Uso:  ./deploy.sh   (o bien `bash deploy.sh`)
# ============================================================
set -e

REPO_DIR="/home/televix/televix"
cd "$REPO_DIR"

echo "[1/5] Pulling cambios de GitHub..."
git fetch --all
git reset --hard origin/main 2>/dev/null || git reset --hard origin/master

echo "[2/5] Instalando dependencias backend (si cambiaron)..."
if [ -f backend/requirements.txt ]; then
    cd backend
    pip install -q -r requirements.txt 2>/dev/null || python3 -m pip install -q -r requirements.txt
    cd ..
fi

echo "[3/5] Build frontend..."
cd frontend
yarn install --silent 2>/dev/null || true
yarn build
cd ..

echo "[4/5] Reiniciando servicios..."
pm2 restart televix-api 2>/dev/null \
  || sudo systemctl restart televix-backend 2>/dev/null \
  || sudo systemctl restart televix 2>/dev/null \
  || echo "[!] Reinicia el backend manualmente"
sudo systemctl reload nginx

echo "[5/5] Repackage .ipk para LG..."
if [ -f packaging/build-lg.sh ]; then
    cd packaging
    rm -rf out
    bash build-lg.sh
    cd ..
fi

echo ""
echo "=================================================="
echo "Deploy completo. $(date)"
echo "=================================================="
[ -d packaging/out ] && ls -la packaging/out/
