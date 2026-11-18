#!/usr/bin/env bash
# Imprime las variables de un stack listas para pegar en Portainer
# (Stacks > <stack> > Environment variables > Advanced mode).
#   scripts/vars-portainer.sh <app> <test|prod>
#
# Deja afuera comentarios, líneas vacías y lo que usan sólo los scripts de
# migración (ORIGEN_*, TABLAS, EXCLUIR_TABLAS): las credenciales de Supabase
# Cloud no tienen que quedar guardadas en Portainer.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
APP="${1:-}"; ENTORNO="${2:-}"
nombre_corto "$APP" >/dev/null 2>&1 || error "uso: $(basename "$0") <app> <test|prod>"
ENV_FILE="$ENV_DIR/$APP-$ENTORNO.env"
[[ -f "$ENV_FILE" ]] || error "falta $ENV_FILE (scripts/nuevo-entorno.sh $APP $ENTORNO)"
grep -E '^[A-Z_][A-Z0-9_]*=' "$ENV_FILE" | grep -vE '^(ORIGEN_[A-Z_]*|TABLAS|EXCLUIR_TABLAS)='
