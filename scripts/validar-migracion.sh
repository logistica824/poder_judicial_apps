#!/usr/bin/env bash
# Compara filas por tabla entre el origen (Cloud) y el destino (stack pj-<app>-<entorno>).
#   scripts/validar-migracion.sh <app> <test|prod> [--sin-origen]
#
# Con --sin-origen usa conteos-origen.txt del último dump (útil después del
# corte, cuando el origen ya no se debe tocar). Sale con código 1 si hay
# diferencias en tablas de la app.
. "$(dirname "$0")/lib.sh"
preparar_app "${1:-}" "${2:-}"

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

if [[ "${3:-}" == --sin-origen ]]; then
  cp "$(ultimo_dump)/conteos-origen.txt" "$tmp/origen"
else
  ORIGEN_DB_URL="$(requerir_env ORIGEN_DB_URL)"
  psql_origen -At -F ' ' -f - < "$RAIZ/scripts/sql/conteos.sql" > "$tmp/origen"
fi
psql_destino -At -F ' ' -f - < "$RAIZ/scripts/sql/conteos.sql" > "$tmp/destino"

# En apps simples sólo importan sus tablas (el proyecto Cloud puede ser compartido).
if [[ "$TIPO" == simple ]]; then
  patron="$(for t in $(requerir_env TABLAS); do printf '^public\\.%s |' "$t"; done)"
  grep -E "${patron%|}" "$tmp/origen"  > "$tmp/o" || true; mv "$tmp/o" "$tmp/origen"
  grep -E "${patron%|}" "$tmp/destino" > "$tmp/d" || true; mv "$tmp/d" "$tmp/destino"
fi

export LC_ALL=C
sort -o "$tmp/origen" "$tmp/origen"; sort -o "$tmp/destino" "$tmp/destino"

printf '%-50s %12s %12s  %s\n' TABLA ORIGEN DESTINO ESTADO
join -a1 -a2 -e '-' -o 0,1.2,2.2 "$tmp/origen" "$tmp/destino" | {
  dif=0
  while read -r tabla o d; do
    if [[ "$o" == "$d" ]]; then estado=OK; else estado=DIFERENTE; dif=1; fi
    printf '%-50s %12s %12s  %s\n' "$tabla" "$o" "$d" "$estado"
  done
  exit $dif
} && log "sin diferencias" || { log "HAY DIFERENCIAS (revisar arriba; las tablas excluidas a propósito aparecen con destino '-')"; exit 1; }
