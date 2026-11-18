#!/usr/bin/env bash
# =============================================================================
# WATHEO - Script de Inicio del Servidor (Linux / macOS)
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVO_CLAVE="$RAIZ/backend/config/clave_dispositivo.txt"

mkdir -p "$(dirname "$ARCHIVO_CLAVE")"

if [[ ! -f "$ARCHIVO_CLAVE" ]]; then
    openssl rand -hex 32 > "$ARCHIVO_CLAVE"
    echo "Se ha generado la clave del dispositivo en backend/config/clave_dispositivo.txt"
fi

export WATHEO_API_KEY="$(tr -d '[:space:]' < "$ARCHIVO_CLAVE")"

echo "WATHEO iniciado en http://127.0.0.1:8100"
php -S 127.0.0.1:8100 -t "$RAIZ"
