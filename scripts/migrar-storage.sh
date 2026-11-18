#!/usr/bin/env bash
# Copia los archivos de Storage de gestion-proyectos (Cloud -> self-hosted) y
# repone los dueños (storage.objects.owner) desde el CSV del último dump.
#   scripts/migrar-storage.sh gestion-proyectos <test|prod>
#
# Correr después de restore.sh (los buckets y sus políticas ya existen).
# El destino se alcanza por la red interna del stack (pj-gestion-<entorno>_default,
# api-gw:8000), sin TLS.
. "$(dirname "$0")/lib.sh"
preparar_app "${1:-}" "${2:-}"
[[ "$APP" == gestion-proyectos ]] || error "sólo gestion-proyectos usa Storage"
DUMP="$(ultimo_dump)"
[[ -f "$DUMP/storage-owners.csv" ]] || error "falta $DUMP/storage-owners.csv (correr dump.sh)"

log "copiando archivos"
docker run --rm --network "${PROYECTO}_default" \
  -v "$RAIZ/scripts/copiar-storage.mjs:/copiar-storage.mjs:ro" \
  -e ORIGEN_URL="$(requerir_env ORIGEN_SUPABASE_URL)" \
  -e ORIGEN_KEY="$(requerir_env ORIGEN_SERVICE_ROLE_KEY)" \
  -e DESTINO_URL=http://api-gw:8000 \
  -e DESTINO_KEY="$(requerir_env SERVICE_ROLE_KEY)" \
  -e BUCKETS="${BUCKETS:-planos evidencias}" \
  node:22-alpine node /copiar-storage.mjs

log "reponiendo dueños de los objetos"
{
  echo "create temp table duenos (bucket_id text, name text, owner uuid, owner_id text);"
  echo "copy duenos from stdin with csv header;"
  cat "$DUMP/storage-owners.csv"
  echo '\.'
  echo "update storage.objects o set owner = d.owner, owner_id = d.owner_id
        from duenos d where o.bucket_id = d.bucket_id and o.name = d.name;"
  echo "select bucket_id, count(*) as objetos, count(owner) as con_owner from storage.objects group by 1 order by 1;"
} | psql_destino --single-transaction

log "listo"
