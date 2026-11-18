#!/usr/bin/env bash
# Funciones comunes de los scripts de migración. Corren en el server, desde el
# clon de este repo (/srv/pj/procom-migracion-pj). Se incluye con:
#   . "$(dirname "$0")/lib.sh"; preparar_app "$1" "$2"
#
# Los stacks los maneja Portainer: acá no se usa `docker compose -f` (pelearía
# con Portainer por el proyecto). Los contenedores se ubican por los labels que
# pone compose (project = nombre del stack en Portainer, service = servicio).
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Variables de cada stack (las mismas que se cargan en Portainer + ORIGEN_*).
ENV_DIR="${PJ_ENV_DIR:-/srv/pj/env}"
# Datos de los stacks (bind mounts absolutos de los composes).
DATOS_DIR="/srv/pj/datos"
# Misma imagen que la base destino: trae psql/pg_dump 17 (sirven contra PG 15 y 17).
PG_IMAGE="supabase/postgres:17.6.1.136"

log()   { printf '\033[1;34m[%s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*" >&2; }
error() { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# Nombre corto de la app: lo usan los stacks (pj-<corto>-<entorno>) y las
# carpetas de datos (/srv/pj/datos/<entorno>/<corto>).
nombre_corto() {
  case "$1" in
    gestion-proyectos)   echo gestion ;;
    horas-extra)         echo horas ;;
    bocas)               echo bocas ;;
    inasistencias)       echo inasistencias ;;
    oficinas-judiciales) echo oficinas ;;
    *) return 1 ;;
  esac
}

# Fija APP, ENTORNO, TIPO, CORTO, PROYECTO, DIR_APP y ENV_FILE.
#   supabase -> GoTrue/Storage/Realtime: dump con la CLI de Supabase
#   simple   -> sólo tablas en public: pg_dump de las tablas de TABLAS
preparar_app() {
  APP="${1:-}"; ENTORNO="${2:-}"
  case "$APP" in
    gestion-proyectos|horas-extra) TIPO=supabase ;;
    bocas|inasistencias)           TIPO=simple ;;
    oficinas-judiciales)           error "oficinas-judiciales no tiene base de datos: no hay nada que migrar" ;;
    *) error "uso: $(basename "$0") <gestion-proyectos|horas-extra|bocas|inasistencias> <test|prod>" ;;
  esac
  [[ "$ENTORNO" == test || "$ENTORNO" == prod ]] || error "entorno inválido '$ENTORNO' (test o prod)"
  CORTO="$(nombre_corto "$APP")"
  PROYECTO="pj-$CORTO-$ENTORNO"
  DIR_APP="$RAIZ/$APP"
  ENV_FILE="$ENV_DIR/$APP-$ENTORNO.env"
  [[ -f "$ENV_FILE" ]] || error "falta $ENV_FILE (scripts/nuevo-entorno.sh $APP $ENTORNO)"
}

# Lee una variable del .env del stack sin hacer `source` (hay valores con
# espacios y <>, como MAIL_FROM). Gana la última aparición.
env_app() {
  local valor
  valor="$(grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2-)" || true
  valor="${valor%\"}"; valor="${valor#\"}"
  printf '%s' "$valor"
}

requerir_env() {
  local v; v="$(env_app "$1")"
  [[ -n "$v" ]] || error "falta $1 en $ENV_FILE"
  printf '%s' "$v"
}

# ID del contenedor en marcha de un servicio del stack: contenedor <servicio>
contenedor() {
  local id
  id="$(docker ps -q -f "label=com.docker.compose.project=$PROYECTO" -f "label=com.docker.compose.service=$1" | head -n1)"
  [[ -n "$id" ]] || error "no hay un contenedor '$1' corriendo en el stack $PROYECTO (¿está desplegado en Portainer?)"
  printf '%s' "$id"
}

# psql contra Supabase Cloud (origen), desde un contenedor descartable.
psql_origen() {
  docker run --rm -i --entrypoint psql "$PG_IMAGE" "$ORIGEN_DB_URL" -X -v ON_ERROR_STOP=1 "$@"
}

pg_dump_origen() {
  docker run --rm --entrypoint pg_dump "$PG_IMAGE" "$ORIGEN_DB_URL" "$@"
}

# psql contra la base del stack (destino) como superusuario, por stdin.
psql_destino() {
  docker exec -i "$(contenedor db)" psql -U supabase_admin -d postgres -X -v ON_ERROR_STOP=1 "$@"
}

# Directorio de trabajo de dumps (fuera de los datos de los stacks). El dump es
# del origen (Cloud), así que es el mismo para testing y producción.
dir_dumps() {
  local d="$RAIZ/dumps/$APP"
  mkdir -p "$d"
  chmod 700 "$RAIZ/dumps" "$d"
  printf '%s' "$d"
}

ultimo_dump() {
  local d
  d="$(ls -1d "$RAIZ/dumps/$APP"/*/ 2>/dev/null | sort | tail -n1)" || true
  [[ -n "$d" ]] || error "no hay dumps en $RAIZ/dumps/$APP (correr dump.sh $APP <entorno>)"
  printf '%s' "${d%/}"
}
