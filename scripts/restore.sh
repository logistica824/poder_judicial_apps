#!/usr/bin/env bash
# Carga el último dump de una app en la base de su stack.
#   scripts/restore.sh <app> <test|prod> [dir-del-dump]
#
# El stack tiene que estar levantado y con la base recién creada (sin datos de
# la app). Todo corre en una única transacción: si algo falla, no queda nada a
# medias. Para repetir: Portainer > Stop del stack, borrar
# /srv/pj/datos/<entorno>/<app>/db y Start (ver RUNBOOK, "base limpia").
. "$(dirname "$0")/lib.sh"
preparar_app "${1:-}" "${2:-}"
DUMP="${3:-$(ultimo_dump)}"
[[ -d "$DUMP" ]] || error "no existe $DUMP"

existentes="$(psql_destino -At -c "select count(*) from pg_tables where schemaname = 'public'")"
if [[ "$existentes" != 0 && "${FORZAR:-0}" != 1 ]]; then
  error "la base destino ya tiene $existentes tablas en public. ¿Restore repetido? (FORZAR=1 para seguir igual)"
fi

log "restaurando $DUMP en $PROYECTO"
if [[ "$TIPO" == supabase ]]; then
  # Mismo orden que la guía oficial de Supabase: roles, esquema y datos con
  # session_replication_role = replica (no disparar triggers ni validar FKs
  # mientras se cargan los COPY en cualquier orden).
  {
    cat "$DUMP/roles.sql"
    cat "$DUMP/schema.sql"
    echo "SET session_replication_role = replica;"
    cat "$DUMP/data.sql"
  } | psql_destino --single-transaction -q -o /dev/null

  log "post-restore ($APP/post-restore.sql)"
  psql_destino --single-transaction -q < "$DIR_APP/post-restore.sql"
else
  psql_destino --single-transaction -q -o /dev/null < "$DUMP/app.sql"
fi

# PostgREST cachea el esquema: avisarle que lo recargue.
psql_destino -q -c "notify pgrst, 'reload schema'"

log "restore terminado; validar con scripts/validar-migracion.sh $APP $ENTORNO"
