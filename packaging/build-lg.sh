#!/bin/bash
# ===========================================================================
# Televix — Empaquetador automático para LG webOS (.ipk)
# Ejecutar en el VPS Ubuntu donde está clonado el repo.
# Requiere: npm i -g @webosose/ares-cli
# ===========================================================================
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WEBOS_DIR="$SCRIPT_DIR/webos"
OUT_DIR="$SCRIPT_DIR/out"

if ! command -v ares-package &> /dev/null; then
    echo "[!] webOS CLI no instalado. Instalando ahora..."
    npm install -g @webosose/ares-cli
fi

mkdir -p "$OUT_DIR"
cd "$OUT_DIR"

# Genera iconos placeholder si faltan
if [ ! -f "$WEBOS_DIR/icon.png" ]; then
    echo "[!] icon.png faltante. Crea uno de 80x80 px en $WEBOS_DIR/icon.png"
fi
if [ ! -f "$WEBOS_DIR/icon-large.png" ]; then
    echo "[!] icon-large.png faltante. Crea uno de 130x130 px en $WEBOS_DIR/icon-large.png"
fi

echo "[*] Empaquetando Televix para LG webOS..."
ares-package "$WEBOS_DIR" -o "$OUT_DIR"

IPK=$(ls -t "$OUT_DIR"/*.ipk 2>/dev/null | head -n1)
if [ -z "$IPK" ]; then
    echo "[X] No se generó el .ipk. Revisa los errores arriba."
    exit 1
fi

echo ""
echo "==========================================================="
echo "✅ Paquete generado:"
echo "   $IPK"
echo ""
echo "Siguientes pasos:"
echo "  1) ares-setup-device     (registra el TV con IP+passphrase)"
echo "  2) ares-install --device lgtv $IPK"
echo "  3) ares-launch  --device lgtv com.televix.app"
echo "==========================================================="
