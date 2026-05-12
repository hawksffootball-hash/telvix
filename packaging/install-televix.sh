#!/bin/bash
# install-televix.sh — Instalador automático Televix para Ubuntu 24.04
# Servidor: 4 vCPU / 8 GB RAM / 200 GB SSD
# Base de datos: MariaDB
#
# Uso:
#   1) Edita las 3 variables de abajo (DOMAIN, REPO_URL, EMAIL)
#   2) Sube este script al VPS como root:
#        scp install-televix.sh root@TU_IP:/root/
#   3) Conéctate y ejecútalo:
#        ssh root@TU_IP
#        chmod +x install-televix.sh
#        ./install-televix.sh
#   4) Espera ~10 minutos
#   5) Abre https://TU_DOMINIO en el navegador
set -e

# ════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN — EDITA ESTOS 3 VALORES ANTES DE EJECUTAR
DOMAIN="televix.tudominio.com"
REPO_URL="https://github.com/TU_USUARIO/televix.git"
EMAIL="tu@correo.com"

# Contraseña de la BD (deja como está o genera otra)
DB_PASSWORD="$(openssl rand -hex 16)"
# ════════════════════════════════════════════════════════════════════

GREEN="\033[1;32m"; YELLOW="\033[1;33m"; NC="\033[0m"
say() { echo -e "${GREEN}▶ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }

[ "$EUID" -eq 0 ] || { echo "Ejecuta como root"; exit 1; }

say "1/10 Actualizando sistema (Ubuntu 24.04)"
DEBIAN_FRONTEND=noninteractive apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

say "2/10 Instalando dependencias del sistema"
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    python3 python3-pip python3-venv python3-dev \
    git nginx ffmpeg curl ufw gnupg \
    build-essential libssl-dev libffi-dev \
    mariadb-server libmariadb-dev pkg-config

say "3/10 Instalando Node.js 20 + Yarn + PM2"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
npm install -g yarn pm2

say "4/10 Configurando MariaDB"
systemctl enable --now mariadb
mysql <<SQL
CREATE DATABASE IF NOT EXISTS televix CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'televix'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON televix.* TO 'televix'@'localhost';
FLUSH PRIVILEGES;
SQL

say "5/10 Creando usuario 'televix'"
id televix &>/dev/null || adduser --disabled-password --gecos "" televix

say "6/10 Clonando repositorio + configurando .env"
sudo -u televix bash <<EOF
set -e
cd /home/televix
[ -d televix ] || git clone "$REPO_URL" televix
cd televix

# Backend .env
cat > backend/.env <<ENV
DATABASE_URL=mysql+aiomysql://televix:$DB_PASSWORD@localhost:3306/televix
CORS_ORIGINS=https://$DOMAIN
ENV

# Frontend .env (URL pública)
cat > frontend/.env <<ENV
REACT_APP_BACKEND_URL=https://$DOMAIN
ENV
EOF

say "7/10 Instalando dependencias Python + build del frontend"
sudo -u televix bash <<EOF
set -e
cd /home/televix/televix
python3 -m venv backend/venv
backend/venv/bin/pip install --upgrade pip
backend/venv/bin/pip install -r backend/requirements.txt

cd frontend
yarn install
yarn build
EOF

say "8/10 Arrancando backend con PM2"
sudo -u televix bash <<EOF
set -e
cd /home/televix/televix/backend
pm2 delete televix-api 2>/dev/null || true
pm2 start "/home/televix/televix/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2" \
    --name televix-api --cwd /home/televix/televix/backend
pm2 save
EOF

# Auto-start PM2 al reiniciar
env PATH="$PATH:/usr/bin" pm2 startup systemd -u televix --hp /home/televix | grep "sudo" | bash || true

say "9/10 Configurando Nginx + SSL Let's Encrypt"
cat > /etc/nginx/sites-available/televix <<NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    root /home/televix/televix/frontend/build;
    index index.html;
    client_max_body_size 100M;

    # Backend API + remuxer ffmpeg + proxy de streams
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # SPA (React) fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/televix /etc/nginx/sites-enabled/televix
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || \
    warn "Certbot falló — revisa que el DNS apunte a este servidor (registro A → IP del VPS)."

say "10/10 Firewall + backups"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Backup diario de la BD a las 3 AM (mantiene 7 días)
mkdir -p /var/backups/televix
cat > /etc/cron.d/televix-backup <<CRON
0 3 * * * root mysqldump --single-transaction televix > /var/backups/televix/televix-\$(date +\\%F).sql && find /var/backups/televix -type f -mtime +7 -delete
CRON

# Guardar credenciales para que el usuario pueda recordarlas
cat > /root/televix-credentials.txt <<CRED
═══════════════════════════════════════════
  TELEVIX — Credenciales del servidor
═══════════════════════════════════════════
Dominio:        https://$DOMAIN
MariaDB user:   televix
MariaDB pass:   $DB_PASSWORD
DB name:        televix
App ubicada en: /home/televix/televix
Backend logs:   pm2 logs televix-api
═══════════════════════════════════════════
CRED
chmod 600 /root/televix-credentials.txt

echo
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅  INSTALACIÓN COMPLETADA                              ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Abre:  https://$DOMAIN${NC}"
echo -e "${GREEN}║  Creds: /root/televix-credentials.txt${NC}"
echo -e "${GREEN}║  Logs:  pm2 logs televix-api${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
