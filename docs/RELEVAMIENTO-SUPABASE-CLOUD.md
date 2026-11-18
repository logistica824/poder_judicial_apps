# Relevamiento de Supabase Cloud — 2026-10-28

Relevamiento de **sólo lectura** de los proyectos Supabase de producción, hecho con un
token personal de la Management API (`sbp_…`) que dio el cliente. Se usaron sólo
consultas GET, el endpoint `database/query/read-only` (rol `supabase_read_only_user`) y
los logs de la plataforma. No se cambió nada en Cloud.

Complementa la auditoría de código ([AUDITORIA-SEGURIDAD.md](AUDITORIA-SEGURIDAD.md)):
los hallazgos nuevos son **S-01 a S-11**. Los datos de personas se muestran agregados o
enmascarados.

## 1. Qué cubre el token

| Proyecto Supabase | Ref | App | Región | Postgres | Estado |
|---|---|---|---|---|---|
| gestion-proyectos | `xcsbtbzrejdxyrexaesy` | gestion-proyectos | sa-east-1 (São Paulo) | 17.6.1.166 | ACTIVE_HEALTHY |
| logisticadepositomailer-bit's Project | `jpvasyuneuzcyzmyitwl` | **inasistencias** (tablas `usuarios`, `solicitudes`, `motivos`, `comentarios_solicitudes`) | us-east-2 (Ohio, EE.UU.) | 17.6.1.155 | ACTIVE_HEALTHY |

- Los dos están en una única organización, **"logisticadepositomailer-bit's Org"**, en **plan Free**.
- **horas-extra y bocas no están en esta organización.** Para ellas sigue pendiente el
  acceso a sus proyectos Supabase (otra cuenta u otra organización).
- Ninguna app comparte proyecto con otra: el caso "Proyecto Supabase compartido" del
  runbook no aplica a gestion ni a inasistencias.

Miembros de la organización:

| Cuenta | Rol | MFA |
|---|---|---|
| `logisticadeposito.mailer@gmail.com` | Owner | **No** |
| `lvm@procomitsolutions.com` (Procom) | Developer | **No** |

## 2. gestion-proyectos (`xcsbtbzrejdxyrexaesy`)

**Base:** 14 MB · extensiones `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`.

| Tabla | Filas | | Tabla | Filas |
|---|---:|---|---|---:|
| checklist_items | 1.591 | | reminders | 7 |
| activity_log | 930 | | buildings | 4 |
| task_steps | 270 | | notas | 3 |
| template_checklist_items | 75 | | profiles | 3 |
| floors | 50 | | projects | 2 |
| tasks | 22 | | templates | 1 |
| floor_plans | 15 | | attachments, plan_markers, protocol_items | 0 |
| template_tasks | 11 | | | |
| comments | 10 | | | |

RLS activa en las 18 tablas.

**Auth**
- 3 usuarios, los 3 con provider `email`, confirmados y del dominio `@justiciacordoba.gob.ar`.
- Los 3 tienen perfil **admin activo**. Dos se registraron con `rol=operador` y después
  los promovieron. Uno nunca inició sesión (alta 2026-08-25). Ver S-05.
- Último login: 2026-10-21. 0 factores MFA.
- **Registro abierto** (`disable_signup=false`) y proveedor email habilitado. **G-01
  sigue abierto en Cloud.** Cloud exige confirmar el email (`mailer_autoconfirm=false`,
  al revés que el `config.toml` del repo) y usa el SMTP por defecto de Supabase
  (`smtp_host` vacío), que sólo entrega a miembros del equipo. Por eso una cuenta
  autorregistrada hoy no podría confirmarse ni iniciar sesión, pero el trigger le crea
  igual el perfil admin.
- `site_url` = `https://gestion-proyectos-inky.vercel.app`.
- Trigger `on_auth_user_created → handle_new_user()` presente: coincide con `post-restore.sql`.

**Storage**

| Bucket | Público | Límite | Objetos | Tamaño |
|---|---|---|---:|---:|
| planos | no | 20 MB | 19 | 8,8 MB |
| evidencias | no | 10 MB | 0 | 0 |

**Otros**
- Sin tablas en la publicación `supabase_realtime`, sin Edge Functions, sin secrets y sin `pg_cron`.
- PostgREST: esquemas `public,graphql_public`, `max_rows=1000`.
- Keys legacy (JWT): `anon` y `service_role`.

**Advisors de Supabase**
- Seguridad:
  - 24 funciones SECURITY DEFINER ejecutables por `anon`, y las mismas 24 por `authenticated` (G-05).
  - `touch_updated_at` con `search_path` mutable.
  - Protección de contraseñas filtradas apagada.
- Rendimiento:
  - 17 claves foráneas sin índice.
  - 19 casos de políticas permisivas múltiples.
  - 4 políticas con `auth.uid()` reevaluado por fila.
  - 12 índices sin uso.

## 3. inasistencias (`jpvasyuneuzcyzmyitwl`)

**Base:** 11 MB.

| Tabla | Filas | RLS | Grants a `anon` |
|---|---:|---|---|
| solicitudes | 125 | **desactivada** (3 políticas `anon` sin efecto) | SELECT, INSERT, UPDATE, DELETE |
| usuarios | 38 | **desactivada** (3 políticas `anon` sin efecto) | SELECT, INSERT, UPDATE, DELETE |
| comentarios_solicitudes | 2 | **desactivada** | SELECT, INSERT, UPDATE, DELETE |
| motivos | 6 | **desactivada** | SELECT, INSERT, UPDATE, DELETE |

**Datos**
- `usuarios`: 1 administrador, 2 verificadores y 35 usuarios. Las **38 contraseñas
  están en texto plano** (ninguna con formato bcrypt ni argon2). Confirma I-03.
- `solicitudes`: inasistencias del 2026-02-12 al 2026-11-16, con última modificación el
  2026-10-27. La app está en uso.
  - Por estado: 119 aprobadas, 4 rechazadas y 2 pendientes de documentación.
  - Por motivo: Particular 45, Estudio 38, **Salud 17**, Retiro 11, Otros 10 y Llegada tarde 4.

**Esquema**
- Columnas en camelCase con comillas (`"fechaInasistencia"`, `"nombreCompleto"`, …).
- Constraints:
  - PK en las 4 tablas.
  - `UNIQUE (usuario)`.
  - FK `comentarios_solicitudes → solicitudes` con `ON DELETE CASCADE`.
- Sin funciones ni triggers propios. `TABLAS` del `.env.example` cubre las 4 tablas.

**Auth y Storage**
- Sin uso: 0 usuarios y 0 buckets.
- Aun así el registro está abierto (`disable_signup=false`) y `site_url=http://localhost:3000`.

**Acceso real en las últimas 24 h** (logs de la plataforma)
- Todas las llamadas a `/rest/v1/*` vienen del servidor (user-agent `node`).
- Hay un `POST /rest/v1/usuarios`: es el upsert del array completo de I-05.
- La anon key no aparece en el frontend: sólo la usa `server/utils/data-store.js`.

**Advisors de Supabase:** 6 errores de seguridad (RLS desactivada en las 4 tablas y
políticas sin efecto en 2) y 1 clave foránea sin índice.

## 4. Configuración común a los dos proyectos

| Aspecto | Valor | Comentario |
|---|---|---|
| Plan | Free | Sin backups descargables (lista vacía), sin PITR, pausa tras 7 días sin actividad, logs de ~1 día |
| SSL obligatorio en la base | No | S-09 |
| Restricción de red de la base | `0.0.0.0/0` | S-09 |
| Contraseña mínima | 6, sin requisitos de caracteres | S-08 |
| Timeout de sesión | Ninguno (`sessions_timebox=0`, `inactivity_timeout=0`) | S-08 |
| Rotación de refresh token | Sí | Correcto |
| Captcha | No | S-08 |
| Pooler | Supavisor, SCRAM | Sesión `:5432`, transacción `:6543` |
| Dominio propio | No | `*.supabase.co` |

## 5. Hallazgos nuevos (S-01 a S-11)

| ID | Sev. | Hallazgo | Evidencia | Corrección |
|---|---|---|---|---|
| S-01 | **Alto** | Los proyectos de dos apps institucionales pertenecen a una **cuenta Gmail** sin MFA; ningún miembro tiene MFA | `GET /organizations/{slug}/members` | MFA ya en las dos cuentas; sumar un Owner institucional del PJ; transferir los proyectos a una organización del PJ hasta la baja |
| S-02 | **Alto** | Plan Free: **no hay backups** recuperables, el proyecto se pausa por inactividad y los logs duran ~1 día. No se puede investigar hacia atrás si G-01 se explotó | `GET /database/backups` → `backups: []`, `pitr_enabled: false`; los logs sólo devuelven las últimas 24 h | Tomar ya un dump lógico de cada proyecto (`scripts/dump.sh`) y guardarlo cifrado; no demorar la migración (on-prem tiene backup diario) |
| S-03 | **Alto** | inasistencias: con la anon key se leen las 38 contraseñas en texto plano y las 125 solicitudes (17 de salud), y se pueden modificar o borrar. Confirma en producción I-03 e I-08, y **sube I-08 a Alto** | RLS desactivada y grants completos a `anon` (sección 3); advisor `rls_disabled_in_public` ×4 | Sin cambiar código: cargar la `service_role` en la variable `SUPABASE_ANON_KEY` de Vercel, después `enable row level security` en las 4 tablas y borrar las políticas `anon`. Probar el login antes y después |
| S-04 | **Medio** | Datos personales y de salud de agentes judiciales alojados en **EE.UU.** (inasistencias, Ohio); gestion en Brasil | Región del proyecto | Que lo valore el área legal del PJ (Ley 25.326, transferencia internacional). La migración on-prem lo resuelve |
| S-05 | **Medio** | gestion: los 3 usuarios son admin y uno nunca entró. El rol operador no se usa | Sección 2, Auth | Confirmar con el PJ quién es admin; pasar el resto a operador; dar de baja la cuenta sin uso; MFA para admins |
| S-06 | **Medio** | G-05 confirmado en Cloud: las 24 funciones SECURITY DEFINER se pueden llamar con la anon key sin sesión | Advisor `anon_security_definer_function_executable` ×24 | En Cloud, la misma sentencia de `post-restore.sql` (probada en laboratorio): `revoke execute on all functions in schema public from public, anon; grant execute on all functions in schema public to authenticated, service_role;` |
| S-07 | Bajo | gestion: `notas` y `reminders` dan SELECT/INSERT/UPDATE/DELETE a `anon`. Las demás tablas no. La RLS (políticas sólo para `authenticated`) lo bloquea hoy | `has_table_privilege('anon', …)`; migraciones `0010` y `0011` no revocan | **On-prem**: `post-restore.sql` ahora revoca. Agregar el `revoke` a las migraciones |
| S-08 | Bajo | Auth sin endurecer en los dos proyectos: contraseña de 6 caracteres sin requisitos, sin timeout de sesión, sin captcha. inasistencias tiene Auth con registro abierto sin usarlo | `GET /config/auth` | Apagar el registro en inasistencias. **On-prem**: `GOTRUE_PASSWORD_MIN_LENGTH`, sesiones con vencimiento |
| S-09 | Bajo | La base acepta conexiones sin SSL y desde cualquier IP | `GET /ssl-enforcement`, `GET /network-restrictions` | Activar SSL enforcement. Restringir a la IP de salida del datacenter durante la migración: las apps usan la API HTTP, no se afectan |
| S-10 | Bajo | Rendimiento: FK sin índice (17 en gestion, 1 en inasistencias), políticas permisivas duplicadas, `auth.uid()` por fila. Con el volumen actual (≤ 15 MB) no se nota | Advisors de rendimiento | Migración de índices en el repo de gestion; unificar políticas `SELECT` |
| S-11 | Bajo | Keys legacy (JWT, sin vencimiento práctico) en los dos proyectos | `GET /api-keys` | **On-prem** se generan claves nuevas (`generar-claves.mjs`). Tras el corte, rotar el JWT secret en Cloud o dar de baja el proyecto |

### Estado de hallazgos previos, verificados en Cloud

| ID | Estado en Cloud al 2026-10-28 |
|---|---|
| G-01 | **Abierto** (registro habilitado). Explotación atenuada por la confirmación de email y el SMTP por defecto. Sin indicios de abuso: 3 usuarios conocidos, ninguno sin confirmar |
| G-05 | **Abierto**, ver S-06 |
| G-10 | Confirmado: el bucket `evidencias` y la tabla `attachments` están vacíos |
| I-03 | **Confirmado**: 38/38 contraseñas en texto plano |
| I-08 | **Confirmado y agravado**, ver S-03 |
| H-01, H-02, H-03, B-xx | Sin verificar: no hay acceso a los proyectos de horas-extra y bocas |

## 6. Impacto en el plan de migración

- **Versiones:** origen 17.6.1.155/.166 y destino `supabase/postgres:17.6.1.136`. Misma
  versión mayor y menor: el `pg_dump` de la imagen sirve sin cambios.
- **`ORIGEN_DB_URL`** (session pooler, IPv4):

  | App | Valor |
  |---|---|
  | gestion | `postgresql://postgres.xcsbtbzrejdxyrexaesy:<password>@aws-1-sa-east-1.pooler.supabase.com:5432/postgres` |
  | inasistencias | `postgresql://postgres.jpvasyuneuzcyzmyitwl:<password>@aws-0-us-east-2.pooler.supabase.com:5432/postgres` |

  La contraseña de la base **no se puede leer** con el token, así que hay dos caminos:
  - Que la provea el Owner.
  - Que el Owner la **resetee**. No afecta a las apps: gestion e inasistencias usan la
    API HTTP con keys, no la contraseña de Postgres.
- **`ORIGEN_SERVICE_ROLE_KEY`** (para `migrar-storage.sh` de gestion): se obtiene con el
  token (`GET /projects/{ref}/api-keys?reveal=true`), sin pedirla.
- **Tiempo de corte estimado:** bajo. gestion tiene 14 MB y 19 archivos (8,8 MB);
  inasistencias tiene 11 MB y no usa Storage ni Auth.
- **gestion, correo:** Cloud usa el SMTP por defecto de Supabase. On-prem hace falta el
  relay del PJ (`SMTP_*`) para recuperar contraseñas. Los 3 usuarios conservan su contraseña (hash bcrypt en el dump).
- **inasistencias, IDs:** la app calcula los IDs con `Math.max+1` (I-05) y las secuencias
  están sin usar. No hace falta ajustarlas después del restore.
- **Plan Free:** si un proyecto se pausa por inactividad, hay que restaurarlo desde el
  Dashboard antes de hacer el dump.

## 7. Cómo se hizo

Management API (`api.supabase.com/v1`), endpoints:

- `projects`, `organizations/{slug}/members`
- `config/auth`, `advisors/{security,performance}`
- `network-restrictions`, `ssl-enforcement`, `database/backups`
- `postgrest`, `functions`, `storage/buckets`, `secrets`, `api-keys?reveal=false`
- `config/database/pooler`
- `database/query/read-only`, con consultas sobre `pg_catalog` y conteos
- `analytics/endpoints/logs`

Los secretos devueltos se ocultaron antes de guardar las respuestas. El token no se
versiona: vive en `.envrc`, fuera del repo.
