#!/usr/bin/env bash
# Exporta los datos de una app desde Supabase Cloud a dumps/<app>/<fecha>/.
#   scripts/dump.sh <app> <test|prod>   (ORIGEN_DB_URL de /srv/pj/env/<app>-<entorno>.env)
#
# supabase (gestion-proyectos, horas-extra): procedimiento oficial de Supabase
#   para migrar de proyecto: roles, esquema y datos con `supabase db dump`
#   (requiere la CLI de Supabase y Docker). Los datos incluyen auth.users e
#   identities (hashes de contraseña y vínculos con Google) y storage.objects.
#   Si el proyecto Cloud es compartido con otra app, excluir sus tablas con
#   EXCLUIR_TABLAS="public.t1 public.t2" en el .env del entorno.
# simple (bocas, inasistencias): pg_dump de las tablas de TABLAS, con esquema,
#   datos, políticas y grants (las tablas no están versionadas en el repo).
. "$(dirname "$0")/lib.sh"
preparar_app "${1:-}" "${2:-}"
ORIGEN_DB_URL="$(requerir_env ORIGEN_DB_URL)"

DESTINO="$(dir_dumps)/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DESTINO"

if [[ "$TIPO" == supabase ]]; then
  command -v supabase >/dev/null || error "falta la CLI de Supabase (https://supabase.com/docs/guides/local-development/cli/getting-started)"

  excluir=()
  for t in $(env_app EXCLUIR_TABLAS); do excluir+=(-x "$t"); done

  log "roles";  supabase db dump --db-url "$ORIGEN_DB_URL" -f "$DESTINO/roles.sql" --role-only
  log "esquema"; supabase db dump --db-url "$ORIGEN_DB_URL" -f "$DESTINO/schema.sql"
  log "datos";  supabase db dump --db-url "$ORIGEN_DB_URL" -f "$DESTINO/data.sql" --use-copy --data-only "${excluir[@]}"

  if [[ "$APP" == gestion-proyectos ]]; then
    # Dueños de los objetos: la subida por API los pisa; se reponen después.
    log "dueños de storage.objects"
    psql_origen -c "\copy (select bucket_id, name, owner, owner_id from storage.objects) to stdout with csv header" \
      > "$DESTINO/storage-owners.csv"
  fi
else
  tablas=()
  for t in $(requerir_env TABLAS); do tablas+=(-t "public.$t"); done
  log "tablas: $(env_app TABLAS)"
  pg_dump_origen --no-owner --quote-all-identifiers "${tablas[@]}" > "$DESTINO/app.sql"
fi

log "conteos del origen"
psql_origen -At -F ' ' -f - < "$RAIZ/scripts/sql/conteos.sql" > "$DESTINO/conteos-origen.txt"

chmod -R go-rwx "$DESTINO"
log "listo: $DESTINO"
ls -lh "$DESTINO" >&2
