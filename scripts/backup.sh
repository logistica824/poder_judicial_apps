#!/usr/bin/env bash
# Backup diario de las bases y del Storage de los stacks (corre en el server).
#   scripts/backup.sh                    # producción, todas las apps con base
#   ENTORNOS="prod test" scripts/backup.sh
#   BACKUP_DIR=/mnt/nas/pj scripts/backup.sh
#
# Por app: pg_dump en formato custom de la base completa (incluye auth y
# storage) + roles. En gestion-proyectos además un tar de los archivos de
# Storage. Retención: RETENCION_DIAS (14 por defecto). Los contenedores se
# ubican por los labels de compose (stack de Portainer pj-<app>-<entorno>).
#
# cron sugerido (root, porque lee /srv/pj/datos; 02:30):
#   30 2 * * * /srv/pj/procom-migracion-pj/scripts/backup.sh >> /var/log/pj-backup.log 2>&1
set -euo pipefail
. "$(dirname "$0")/lib.sh"
BACKUP_DIR="${BACKUP_DIR:-/srv/backups/pj}"
RETENCION_DIAS="${RETENCION_DIAS:-14}"
ENTORNOS="${ENTORNOS:-prod}"
FECHA="$(date +%Y%m%d-%H%M%S)"
APPS=(gestion-proyectos horas-extra bocas inasistencias)

umask 077
errores=0
for entorno in $ENTORNOS; do
  for app in "${APPS[@]}"; do
    corto="$(nombre_corto "$app")"
    proyecto="pj-$corto-$entorno"
    dir="$BACKUP_DIR/$entorno/$app"; mkdir -p "$dir"
    db="$(docker ps -q -f "label=com.docker.compose.project=$proyecto" -f label=com.docker.compose.service=db | head -n1)"
    if [[ -z "$db" ]]; then
      echo "[$proyecto] db no está corriendo, se saltea" >&2; errores=1; continue
    fi

    echo "[$proyecto] pg_dump"
    if docker exec "$db" pg_dump -U supabase_admin -d postgres -Fc > "$dir/$FECHA.dump" \
       && docker exec "$db" pg_dumpall -U supabase_admin --roles-only > "$dir/$FECHA-roles.sql"; then
      echo "[$proyecto] ok $(du -h "$dir/$FECHA.dump" | cut -f1)"
    else
      echo "[$proyecto] FALLÓ el pg_dump" >&2; rm -f "$dir/$FECHA.dump" "$dir/$FECHA-roles.sql"; errores=1
    fi

    if [[ "$app" == gestion-proyectos ]]; then
      echo "[$proyecto] storage"
      tar -C "$DATOS_DIR/$entorno/$corto" -czf "$dir/$FECHA-storage.tar.gz" storage \
        || { echo "[$proyecto] FALLÓ el tar de storage" >&2; errores=1; }
    fi

    find "$dir" -type f -mtime +"$RETENCION_DIAS" -delete
  done
done

# Copia fuera del host (NAS / otro servidor): definir BACKUP_REMOTO, p. ej.
#   BACKUP_REMOTO=backup@nas.pj.local:/backups/pj
if [[ -n "${BACKUP_REMOTO:-}" ]]; then
  rsync -a --delete "$BACKUP_DIR/" "$BACKUP_REMOTO/" || { echo "FALLÓ la copia remota" >&2; errores=1; }
fi

exit $errores
