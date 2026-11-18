#!/usr/bin/env bash
# Relevamiento (sólo lectura) del proyecto Supabase Cloud de una app.
#   scripts/relevar-origen.sh <app> <test|prod>  > relevamiento-<app>.txt
# Usa ORIGEN_DB_URL de /srv/pj/env/<app>-<entorno>.env.
. "$(dirname "$0")/lib.sh"
preparar_app "${1:-}" "${2:-}"
ORIGEN_DB_URL="$(requerir_env ORIGEN_DB_URL)"

log "relevando el origen de $APP"
# Sin ON_ERROR_STOP: si una sección no aplica (p. ej. no hay auth.identities),
# se informa el error y se sigue con las demás.
psql_origen -v ON_ERROR_STOP=0 -f - < "$RAIZ/scripts/sql/relevamiento.sql"

log "conteo exacto de filas"
psql_origen -At -F ' ' -f - < "$RAIZ/scripts/sql/conteos.sql"
