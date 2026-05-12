# Guía rápida de instalación Televix en VPS Ubuntu 24.04

## Tu VPS
- 4 vCPU · 8 GB RAM · 200 GB SSD · Ubuntu 24.04
- Capacidad: 15–25 usuarios concurrentes con remuxing MKV→MP4

## Pasos

### 1. Push tu código a GitHub
Desde Emergent: click en **"Save to GitHub"** y conecta tu cuenta. Anota la URL del repo (ej. `https://github.com/tuusuario/televix.git`).

### 2. Compra un dominio
Cualquiera funciona:
- **Namecheap** ~$10/año
- **Porkbun** ~$10/año
- **Cloudflare Registrar** (al costo, ~$8/año)

Después en el panel del DNS añade un **registro A**:
```
Tipo: A
Nombre: televix       (o @ si quieres el dominio raíz)
Valor: TU_IP_VPS
TTL: 300
```

Espera 5–15 min a que propague (puedes verificar con `dig televix.tudominio.com` o https://dnschecker.org).

### 3. Edita el script

Abre `install-televix.sh` y cambia las 3 líneas de la parte CONFIGURACIÓN:

```bash
DOMAIN="televix.tudominio.com"
REPO_URL="https://github.com/tuusuario/televix.git"
EMAIL="tu@correo.com"
```

### 4. Sube y ejecuta el script en el VPS

Desde tu PC:
```bash
scp install-televix.sh root@TU_IP_VPS:/root/
ssh root@TU_IP_VPS
chmod +x install-televix.sh
./install-televix.sh
```

El script tarda ~10 minutos. Al finalizar te imprime las credenciales y la URL.

### 5. Abre tu app

Visita `https://televix.tudominio.com` en cualquier navegador.

### 6. Actualizar paquetes Smart TV con la nueva URL

```bash
# En tu PC con el código clonado
cd packaging/webos
# Edita index.html línea del iframe — cambia la URL preview por tu dominio
ares-package . -o ../dist
ares-install --device tv ../dist/com.televix.app_1.0.0_all.ipk

# Igual para Tizen
cd ../tizen
# Edita index.html
# Empaquetar con Tizen Studio o tizen CLI
```

## Comandos útiles después de instalar

```bash
# Ver logs del backend
sudo -u televix pm2 logs televix-api

# Reiniciar backend
sudo -u televix pm2 restart televix-api

# Actualizar la app (cuando subas cambios a GitHub)
cd /home/televix/televix
sudo -u televix git pull
sudo -u televix bash -c "cd frontend && yarn build"
sudo -u televix pm2 restart televix-api

# Ver estado MariaDB
sudo systemctl status mariadb

# Conectar a la BD
mysql -u televix -p$(grep "MariaDB pass" /root/televix-credentials.txt | awk '{print $NF}') televix

# Ver backups
ls -lh /var/backups/televix/

# Ver uso de recursos
htop
```

## Problemas comunes

| Problema | Solución |
|---|---|
| Certbot falla | El DNS aún no propagó. Espera 15 min y corre `certbot --nginx -d tudominio.com` manualmente |
| `pm2 logs` muestra error de conexión a MariaDB | Verifica `DATABASE_URL` en `/home/televix/televix/backend/.env` |
| Películas no cargan | ¿ffmpeg está instalado? `ffmpeg -version`. Si no: `apt install ffmpeg` |
| Página en blanco | Verifica `REACT_APP_BACKEND_URL` en `frontend/.env` y vuelve a hacer `yarn build` |
| 502 Bad Gateway | `pm2 status` para ver si el backend está corriendo |
