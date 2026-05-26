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
# Detectar cómo corre el backend e intentar reiniciar de la forma correcta
if systemctl list-units --type=service --all 2>/dev/null | grep -qi 'televix-api\|televix-backend\|televix\.service'; then
    SRV=$(systemctl list-units --type=service --all 2>/dev/null | grep -i 'televix' | awk '{print $1}' | grep -v pm2 | head -1)
    [ -n "$SRV" ] && sudo systemctl restart "$SRV" && echo "Reiniciado: $SRV"
fi
# Fallback: matar uvicorn (systemd lo respawnea si está configurado)
sudo pkill -f "uvicorn server:app" 2>/dev/null || true
sleep 3
# Si no volvió a levantarse, lanzar manualmente
if ! curl -sf http://localhost:8001/api/ -o /dev/null; then
    sudo -u televix bash -c "cd /home/televix/televix/backend && source venv/bin/activate && nohup uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2 > /var/log/televix-backend.log 2>&1 &"
    sleep 3
fi
curl -s http://localhost:8001/api/ -o /dev/null -w "Backend HTTP %{http_code}\n"
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
