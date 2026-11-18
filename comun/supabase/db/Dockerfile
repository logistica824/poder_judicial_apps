# Postgres de Supabase con los scripts de init adentro de la imagen.
# Portainer CE no resuelve bind mounts relativos en stacks desde Git (eso es
# "relative path volumes", sólo BE): por eso los SQL van con COPY y no montados.
# Corren sólo en la primera inicialización (carpeta de datos vacía).
#
#   minima    roles y JWT (bocas, inasistencias: sólo PostgREST)
#   completa  + webhooks, realtime y base _supabase (gestion, horas)

FROM supabase/postgres:17.6.1.136 AS minima
COPY roles.sql /docker-entrypoint-initdb.d/init-scripts/99-roles.sql
COPY jwt.sql   /docker-entrypoint-initdb.d/init-scripts/99-jwt.sql

FROM minima AS completa
COPY webhooks.sql  /docker-entrypoint-initdb.d/init-scripts/98-webhooks.sql
COPY realtime.sql  /docker-entrypoint-initdb.d/migrations/99-realtime.sql
COPY _supabase.sql /docker-entrypoint-initdb.d/migrations/97-_supabase.sql
