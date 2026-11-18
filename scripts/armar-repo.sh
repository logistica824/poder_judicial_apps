#!/usr/bin/env bash
# Copia al clon del repo de una app los archivos que necesita su stack de
# Portainer (compose, Dockerfiles, configs de Supabase). Corre en la PC de
# Procom, sobre un clon fresco del repo del cliente; después: revisar el diff,
# commit, push a main y actualizar la rama testing.
#   scripts/armar-repo.sh <app> <ruta-del-clon>
#
# Fuente única: este repo. En el repo de la app quedan en la raíz
# docker-compose.yml, Dockerfile y .dockerignore, y en deploy/ lo demás.
# Volver a correrlo pisa esos archivos con la versión de acá.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:-}"; REPO="${2:-}"
[[ -n "$APP" && -d "$RAIZ/$APP" && -n "$REPO" ]] || { echo "uso: $0 <app> <ruta-del-clon>" >&2; exit 1; }
[[ -d "$REPO/.git" ]] || { echo "$REPO no es un clon de git" >&2; exit 1; }

copiar() { mkdir -p "$(dirname "$REPO/$2")"; cp "$RAIZ/$1" "$REPO/$2"; echo "  $2"; }
db() {
  for f in Dockerfile roles.sql jwt.sql webhooks.sql realtime.sql _supabase.sql; do
    copiar "comun/supabase/db/$f" "deploy/db/$f"
  done
}
envoy() {
  for f in Dockerfile envoy.yaml cds.yaml lds.template.yaml docker-entrypoint.sh; do
    copiar "comun/supabase/api/envoy/$f" "deploy/envoy/$f"
  done
}

echo "[$APP] -> $REPO"
copiar "$APP/docker-compose.yml" docker-compose.yml
copiar "$APP/.env.example" deploy/.env.example
case "$APP" in
  gestion-proyectos|horas-extra)
    copiar comun/docker/next.Dockerfile Dockerfile
    copiar comun/docker/dockerignore .dockerignore
    db; envoy ;;
  bocas)
    copiar comun/docker/next.Dockerfile Dockerfile
    copiar comun/docker/dockerignore .dockerignore
    db ;;
  inasistencias)
    copiar inasistencias/Dockerfile deploy/web/Dockerfile
    copiar inasistencias/rest-gw/Dockerfile deploy/rest-gw/Dockerfile
    copiar inasistencias/rest-gw/Caddyfile deploy/rest-gw/Caddyfile
    db ;;
  oficinas-judiciales)
    # El equipo del PJ subió "dockerfile" en minúscula: en Linux el build busca
    # "Dockerfile" y fallaría. Renombrar con git antes de copiar (en Windows el
    # disco no distingue mayúsculas y un cp dejaría el nombre viejo).
    if git -C "$REPO" ls-files --error-unmatch dockerfile >/dev/null 2>&1; then
      git -C "$REPO" mv -f dockerfile Dockerfile; echo "  (dockerfile -> Dockerfile)"
    fi
    copiar oficinas-judiciales/Dockerfile Dockerfile
    copiar comun/docker/dockerignore .dockerignore ;;
  *) echo "app desconocida: $APP" >&2; exit 1 ;;
esac

cat > "$REPO/deploy/LEEME.md" <<MD
# Despliegue (Portainer)

Archivos generados desde el repo de infraestructura de Procom
(\`procom-migracion-pj\`, \`scripts/armar-repo.sh $APP\`). **No editar acá**: los
cambios se hacen allá y se vuelven a copiar.

- \`docker-compose.yml\` (raíz): stack de Portainer. \`pj-<app>-test\` sigue la rama
  \`testing\` y \`pj-<app>-prod\` sigue \`main\`, ambos con actualización automática.
- \`deploy/.env.example\`: variables del stack (se cargan en Portainer).
- Procedimiento completo: \`docs/RUNBOOK-MIGRACION.md\` del repo de Procom.
MD
echo "  deploy/LEEME.md"
git -C "$REPO" status --short
