#!/bin/bash
# ===========================================================================
# Televix — Empaquetador para Samsung Tizen (.wgt)
# Requiere: Tizen Studio CLI (instalado en VPS o desktop) + certificado Samsung.
# Si vas a firmar, hazlo desde un PC con Tizen Studio (GUI Certificate Manager).
# ===========================================================================
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TIZEN_DIR="$SCRIPT_DIR/tizen"
OUT_DIR="$SCRIPT_DIR/out"

if ! command -v tizen &> /dev/null; then
    cat <<'EOF'
[X] Tizen CLI no detectado.

Para empaquetar el .wgt de Samsung necesitas Tizen Studio.
Lo más fácil:
  1) Instala Tizen Studio en tu PC (Windows/Mac/Linux):
     https://developer.tizen.org/development/tizen-studio/download
  2) Configura el certificado Samsung (Tools → Certificate Manager → +).
  3) Importa la carpeta /app/packaging/tizen como proyecto.
  4) Click derecho → Build Signed Package → genera Televix.wgt.

Si quieres compilar SIN firmar (solo para tests locales en emulador):
  apt install -y zip
  cd packaging/tizen && zip -r ../out/Televix-unsigned.wgt *
  ⚠️ El TV REAL rechazará un .wgt sin firmar.
EOF
    exit 1
fi

mkdir -p "$OUT_DIR"
echo "[*] Empaquetando Televix para Samsung Tizen..."
tizen package -t wgt -o "$OUT_DIR" -- "$TIZEN_DIR"

echo ""
echo "==========================================================="
echo "✅ Paquete .wgt generado en: $OUT_DIR"
echo ""
echo "Instalar en TV:"
echo "  sdb connect <IP_DEL_TV>:26101"
echo "  sdb devices"
echo "  tizen install -n Televix.wgt -t <DEVICE_NAME>"
echo "==========================================================="
