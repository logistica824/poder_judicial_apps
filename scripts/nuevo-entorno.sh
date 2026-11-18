#!/usr/bin/env bash
# Crea el archivo de variables de un stack (corre en el server).
#   scripts/nuevo-entorno.sh <app> <test|prod>
#
# Parte de <app>/.env.example de este repo: reemplaza {{ENTORNO}} y {{SUF}}
# ("-test" en testing, vacío en producción) y agrega secretos nuevos con
# scripts/generar-claves.mjs (en un contenedor node descartable: el host no
# necesita node). Resultado: /srv/pj/env/<app>-<entorno>.env (chmod 600).
#
# Después: completar a mano lo que quedó vacío (API keys, SMTP, ORIGEN_*) y
# cargar en Portainer la salida de scripts/vars-portainer.sh <app> <entorno>.
# Guardar una copia del archivo en el gestor de secretos del PJ.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
APP="${1:-}"; ENTORNO="${2:-}"
nombre_corto "$APP" >/dev/null 2>&1 || error "uso: $(basename "$0") <gestion-proyectos|horas-extra|bocas|inasistencias|oficinas-judiciales> <test|prod>"
[[ "$ENTORNO" == test || "$ENTORNO" == prod ]] || error "entorno inválido '$ENTORNO' (test o prod)"

EJEMPLO="$RAIZ/$APP/.env.example"
DESTINO="$ENV_DIR/$APP-$ENTORNO.env"
[[ -f "$EJEMPLO" ]] || error "falta $EJEMPLO"
[[ ! -e "$DESTINO" ]] || error "$DESTINO ya existe: no se pisa (los secretos cambiarían y la base quedaría inaccesible)"

if [[ "$ENTORNO" == test ]]; then SUF=-test; else SUF=; fi

umask 077
mkdir -p "$ENV_DIR"; chmod 700 "$ENV_DIR"
sed -e "s/{{ENTORNO}}/$ENTORNO/g" -e "s/{{SUF}}/$SUF/g" "$EJEMPLO" > "$DESTINO"

# Testing con datos reales restaurados: el recordatorio semanal no tiene que salir.
if [[ "$APP" == horas-extra && "$ENTORNO" == test ]]; then
  sed -i 's/^CRON_SCHEDULE=.*/CRON_SCHEDULE=0 0 31 2 */' "$DESTINO"
fi

if [[ "$APP" != oficinas-judiciales ]]; then
  docker run --rm -v "$RAIZ/scripts/generar-claves.mjs:/generar-claves.mjs:ro" \
    node:22-alpine node /generar-claves.mjs >> "$DESTINO"
fi
chmod 600 "$DESTINO"

log "creado $DESTINO"
vacias="$(grep -E '^[A-Z_]+=$' "$DESTINO" | cut -d= -f1 | tr '\n' ' ')" || true
[[ -z "$vacias" ]] || log "completar a mano: $vacias"
