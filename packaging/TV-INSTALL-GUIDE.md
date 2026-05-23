# Guía rápida — Instalar Televix en Samsung TV y LG TV

> Estado: la app web ya corre en **https://moviesymas.vip**.  
> Los wrappers nativos cargan ese sitio en un iframe y exponen un reproductor
> **AVPlay (Tizen)** / **video tag webOS** que sí soporta MKV con selector de
> audio y subtítulos.

---

## 🔵 SAMSUNG TIZEN (`.wgt`)

### 1) Activar Developer Mode en el TV
1. Abre **Smart Hub → Apps**.
2. Con el control: presiona los números `1 2 3 4 5` (rápido).
3. Se abre el panel "Developer Mode" → **ON**.
4. Pon la **IP de tu PC** (donde está Tizen Studio) y reinicia el TV.

### 2) Instalar Tizen Studio (en tu PC)
- Descarga **Tizen Studio with Native Tools**:  
  https://developer.tizen.org/development/tizen-studio/download
- Abre **Package Manager** y instala:
  - `4.0 TV Extensions` (o la versión de tu TV)
  - `Samsung Certificate Extension`
  - `Samsung TV SDK`

### 3) Crear certificado (una sola vez)
1. En Tizen Studio: **Tools → Certificate Manager → +**
2. Tipo: **Samsung** → Author + Distributor → perfil **Public**.
3. Login con cuenta Samsung → conecta el TV con el "DUID".

### 4) Empaquetar Televix
```bash
cd /home/televix/televix/packaging
# (opcional) reemplaza icon.png por uno tuyo 117x117
ls tizen/
# config.xml  icon.png  index.html
```

En Tizen Studio:
1. **File → Import → Tizen → Tizen Project** → selecciona la carpeta `tizen/`.
2. Click derecho sobre el proyecto → **Build Signed Package** → genera `Televix.wgt`.

### 5) Instalar en el TV
```bash
# Conectar al TV (mismo Wi-Fi)
sdb connect 192.168.1.XX:26101    # IP de tu TV
sdb devices                        # debe listar el TV
tizen install -n Televix.wgt -t <DEVICE_NAME>
```
O desde Tizen Studio: click derecho → **Run As → Tizen Web Application**.

### 6) Controles dentro de la app TV
- **OK / Enter**: pausa/play
- **◀ / ▶**: ±10 segundos
- **Tecla 1**: menú de **pistas de audio**
- **Tecla 2**: menú de **subtítulos**
- **Return/Back**: salir del player

---

## 🔴 LG WEBOS (`.ipk`)

### 1) Activar Developer Mode en el TV
1. LG Content Store → busca **"Developer Mode"** → instálala.
2. Abre la app, crea cuenta en https://webostv.developer.lge.com/
3. Login en la app del TV → activa **Dev Mode ON** → muestra la **IP del TV** y un **passphrase**.

### 2) Instalar webOS CLI (en tu PC)
```bash
# Requiere Node.js
npm install -g @webos-tools/cli
```
Verifica:
```bash
ares -V
```

### 3) Registrar el TV (una vez)
```bash
ares-setup-device
# Add device:
#   name: lgtv
#   host: <IP_DEL_TV>
#   port: 9922
#   user: prisoner
#   passphrase: <el que muestra Dev Mode App en el TV>
ares-novacom --device lgtv --getkey      # baja la llave SSH
```

### 4) Empaquetar Televix
```bash
cd /home/televix/televix/packaging
# (opcional) reemplaza icon.png (80x80) e icon-large.png (130x130)
ares-package webos/
# Genera: com.televix.app_1.0.0_all.ipk
```

### 5) Instalar en el TV
```bash
ares-install --device lgtv com.televix.app_1.0.0_all.ipk
ares-launch --device lgtv com.televix.app
```

### 6) Controles dentro de la app TV
- **OK / Enter**: pausa/play
- **◀ / ▶**: ±10 segundos
- **Tecla 1**: menú de **pistas de audio**
- **Tecla 2**: menú de **subtítulos**
- **Back**: salir del player

---

## 🧪 ¿Cómo verifico que funciona el "puente nativo"?

1. Abre la app Televix en el TV (Samsung o LG).
2. Reproduce una película VOD que esté en MKV.
3. **Antes**: el navegador remuxeaba con ffmpeg y solo expone 1 pista.
4. **Ahora**: el wrapper detecta el flag `?tv=tizen` / `?tv=webos`, envía la URL
   original del MKV al reproductor nativo del TV (AVPlay para Samsung, HTML5
   video con `mediaOption` para LG), y ahí sí aparecen **todas** las pistas de
   audio/subs cuando presionas `1` o `2` en el control remoto.

---

## 🔧 Si algo falla

| Problema | Diagnóstico |
|---|---|
| App carga pero queda en negro al reproducir | Revisa que el TV pueda alcanzar `https://moviesymas.vip` (curl desde la misma red Wi-Fi). |
| Samsung dice "Invalid Package" | El certificado de Tizen no cubre el DUID del TV. Vuelve a Certificate Manager y agrega el DUID. |
| LG "Failed to install" | El TV no está registrado con `ares-setup-device` o la passphrase cambió. |
| El reproductor nativo no abre | Comprueba que en la URL del iframe aparece `?tv=tizen` o `?tv=webos`. Edita `tizen/index.html` o `webos/index.html` si modificas el dominio. |

---

## 📝 Notas

- Los `.wgt` y `.ipk` son solo wrappers — **NO** necesitas reempaquetar cuando
  hagas cambios en el frontend. Basta con desplegar el nuevo build a
  `https://moviesymas.vip` y el TV verá los cambios al reiniciar la app.
- Cambiar de dominio: edita `src=` en `tizen/index.html` y `webos/index.html`,
  además del bloque `<tizen:allow-navigation>` en `tizen/config.xml`.
