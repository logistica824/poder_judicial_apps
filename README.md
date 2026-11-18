# Migración de aplicaciones del Poder Judicial de Córdoba — Vercel + Supabase → Portainer on-prem

Infraestructura como código (Procom IT Solutions) para correr en el servidor Ubuntu
24.04 del PJ (Docker Standalone + **Portainer CE 2.45**) las 5 aplicaciones que hoy
están en Vercel con datos en Supabase Cloud. **El código de las aplicaciones no se
modifica**: a cada repo del cliente se le agregan los archivos de despliegue
(`docker-compose.yml`, Dockerfiles, `deploy/`) con `scripts/armar-repo.sh`, y
Portainer los despliega desde GitHub. Testing y producción conviven en el mismo
servidor: `pj-<app>-test` (rama `testing`) y `pj-<app>-prod` (rama `main`).

| App | Stack | Backend en el servidor | URL prod / testing |
|---|---|---|---|
| gestion-proyectos | Next.js 16 | Supabase self-hosted: Postgres, GoTrue, PostgREST, Storage, Studio | `gestion[-test].` / `api-gestion[-test].` |
| horas-extra | Next.js 14 | Supabase self-hosted: Postgres, GoTrue (Google), PostgREST, Realtime, Studio + cron | `horas[-test].` / `api-horas[-test].` |
| bocas | Next.js 16 (client-side) | Postgres + PostgREST | `bocas[-test].` / `api-bocas[-test].` |
| inasistencias | Express 5 | Postgres + PostgREST (internos) | `inasistencias[-test].` |
| oficinas-judiciales | Next.js 16 (standalone) | — (sin base; mails por Resend) | `oficinas[-test].` |

## Estructura

```
proxy/                 Traefik (stack pj-proxy desde este repo): TLS y ruteo por hostname; ver proxy/LEEME.md
<app>/                 kit de cada app: docker-compose.yml y .env.example (se copian al repo de la app),
                       post-restore.sql (gestion, horas), Dockerfile y rest-gw/ (inasistencias, oficinas)
comun/
  docker/              Dockerfile de las apps Next (gestion, horas, bocas) y .dockerignore
  supabase/db/         imagen de Postgres con los SQL de init (targets minima / completa)
  supabase/api/envoy/  imagen del gateway Envoy con su configuración
scripts/
  armar-repo.sh        copia el kit de una app a un clon de su repo (PC de Procom)
  nuevo-entorno.sh     genera /srv/pj/env/<app>-<entorno>.env con secretos (server)
  vars-portainer.sh    imprime las variables para pegar en Portainer (server)
  relevar-origen, dump, restore, migrar-storage, validar-migracion, backup (server)
docs/RUNBOOK-MIGRACION.md   procedimiento paso a paso (deploy, verificación, corte)
docs/AUDITORIA-SEGURIDAD.md hallazgos de seguridad de las 5 apps y plan de corrección
docs/RELEVAMIENTO-SUPABASE-CLOUD.md estado real de los proyectos Supabase Cloud
informe/       informes para el cliente y su generador
dumps/     (no versionado) exportaciones de Supabase Cloud durante la migración
```

El procedimiento completo está en [docs/RUNBOOK-MIGRACION.md](docs/RUNBOOK-MIGRACION.md).

## Reglas de diseño

- **Portainer CE no monta archivos con ruta relativa** en stacks desde Git (es una
  función de Business Edition). Las configuraciones van dentro de imágenes que el stack
  construye (`pull_policy: build`), y todo lo que se monta usa rutas absolutas:
  `/srv/pj/certs`, `/srv/pj/datos/<entorno>/<app>`.
- **Testing y producción en el mismo host:** todo nombre global lleva `${ENTORNO}`
  (`test` | `prod`): routers, services y middlewares de Traefik, tags de imagen,
  carpetas de datos. El nombre del stack en Portainer (`pj-<app>-<entorno>`) es el
  proyecto de compose; los scripts ubican los contenedores por ese label.
- **Una red compartida `edge`** entre Traefik y las apps. Sólo entran a `edge` los
  servicios que publica Traefik (`web`, `api-gw`, `bocas-rest`), y nunca con un nombre
  que el Envoy resuelva (`rest`, `auth`, `storage`, `meta`, `studio`, `functions`):
  Docker publica en `edge` el nombre de servicio y el Envoy de otro stack lo resolvería.
- Nada publica puertos en el host salvo Traefik. Las bases no son accesibles desde afuera.
- `NEXT_PUBLIC_*` se embeben en el build: si cambia una URL pública, *Update the stack*
  en Portainer reconstruye la imagen.
- Secretos: en las variables de cada stack de Portainer y en `/srv/pj/env/` (chmod 600),
  generados con `scripts/generar-claves.mjs`; distintos por entorno. Nunca en git.
- Versiones de imagen fijadas (tags exactos del self-hosting oficial de Supabase).
