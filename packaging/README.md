# Empaquetado para Smart TVs

Esta carpeta contiene los archivos mínimos para empaquetar Televix como aplicación
nativa de Samsung (Tizen, formato `.wgt`) y LG (webOS, formato `.ipk`).

> Cada paquete es un *wrapper* HTML que carga la app web dentro de un iframe a
> pantalla completa. Esto permite mantener una sola base de código y enviar
> actualizaciones instantáneas sin reempaquetar.

---

## Samsung Tizen (.wgt)

### Requisitos
- **Tizen Studio** con la extensión TV: <https://developer.tizen.org/development/tizen-studio/download>
- **Samsung Certificate Manager** (Author + Distributor "Public" o "Partner") para firmar
- TV en *Developer Mode* (Apps → 12345 → activar Developer Mode → poner IP del PC)

### Empaquetar
1. Reemplaza la URL del `iframe` en `tizen/index.html` por tu URL pública si cambia.
2. Coloca un `icon.png` (117×117 px PNG transparente) dentro de `tizen/`.
3. Importa la carpeta `tizen/` como proyecto en Tizen Studio (TV-Samsung profile).
4. *Project → Build Signed Package* → genera `Televix.wgt`.
5. *Right-click project → Run As → Tizen Web Application* para instalar en el TV.

### Instalación manual
```bash
sdb connect <IP_DEL_TV>:26101
tizen install -n Televix.wgt
```

---

## LG webOS (.ipk)

### Requisitos
- **webOS TV CLI**: <https://webostv.developer.lge.com/develop/tools/cli-installation>
- TV en *Developer Mode* con la app **Developer Mode** instalada (LG Content Store).
- Llave de desarrollador (key passphrase) registrada con el TV.

### Empaquetar
1. Reemplaza la URL del `iframe` en `webos/index.html` si cambia.
2. Añade `icon.png` (80×80) e `icon-large.png` (130×130) dentro de `webos/`.
3. Empaquetar:
   ```bash
   ares-package webos/
   # genera com.televix.app_1.0.0_all.ipk
   ```
4. Instalar en el TV:
   ```bash
   ares-setup-device   # registra el TV (una vez)
   ares-install --device tv com.televix.app_1.0.0_all.ipk
   ares-launch --device tv com.televix.app
   ```

---

## Notas para producción

- El backend FastAPI debe estar accesible públicamente sobre HTTPS para que el TV
  acepte cargar contenido. Esta variable se controla con `REACT_APP_BACKEND_URL`
  en el frontend.
- Para uso offline / *standalone* sin iframe: copia el build de `frontend/build/`
  dentro del paquete y ajusta `index.html` / `config.xml` para apuntar a esos
  archivos directamente. Tendrás que reempaquetar en cada release.
- Tizen TV bloquea `localStorage` muy grande (>5 MB). El estado de la app es
  pequeño así que no hay riesgo.
- LG webOS 4+ y Tizen 4+ soportan `hls.js` y `MSE` sin problemas.
