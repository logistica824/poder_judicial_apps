# Auditoría de seguridad — aplicaciones del Poder Judicial de Córdoba

Auditoría estática (sólo lectura) del código de las 5 aplicaciones, más `npm audit` sobre
cada lockfile y pruebas en el laboratorio de la migración. Fecha: 2026-10-26. Las rutas
son relativas a la raíz de cada repo.

**Actualización 2026-10-28:** se sumó la verificación de los proyectos Supabase Cloud de
gestion e inasistencias, con detalle en
[RELEVAMIENTO-SUPABASE-CLOUD.md](RELEVAMIENTO-SUPABASE-CLOUD.md). Se agregan los hallazgos
S-01 a S-11 (sección 1.8), I-08 sube a Alto y G-01 queda abierto en Cloud. Total: **57
hallazgos** (6 críticos, 16 altos, 21 medios, 14 bajos).

Severidades:

| Severidad | Criterio |
|---|---|
| **Crítico** | Cualquiera puede leer, modificar o borrar datos, o tomar control de cuentas, sin hacer nada raro |
| **Alto** | Riesgo real de incidente, fuga o pérdida de datos |
| **Medio** | Seguridad en profundidad, abuso o correctitud |
| **Bajo** | Higiene y mantenibilidad |

## Contexto y premisas corregidas

- **"Las apps están protegidas por su login."** No en dos de ellas. bocas no tiene
  autenticación en el servidor y su login es una comparación en el navegador.
  inasistencias decide quién es el usuario a partir de encabezados HTTP que manda el
  propio navegador. En ambas, cualquiera con acceso a la URL puede operar.
- **"La seguridad vive en la base (RLS)."** En gestion y horas es mayormente cierto y
  está bien hecho, con agujeros puntuales: G-01 a G-05 y H-01 a H-05.
- **"Los datos no están en el código."** Correcto en general. Las excepciones son
  credenciales y emails reales versionados (G-03, H-03, B-02, O-02).
- Los repos se recibieron **sin `.git`**: no se pudo revisar el historial en busca de
  secretos. Ver el paso 5.2.

## Decisiones que necesita el PJ

1. **Exposición de bocas e inasistencias hasta que se corrijan** (B-01..B-03, I-01).
   Recomendación: publicarlas sólo en la red interna (es lo previsto) y no fuera de ella.
2. **Estándar de autenticación** para bocas e inasistencias:
   - Supabase Auth, la que ya usan gestion y horas.
   - SSO institucional (Keycloak/OIDC o la cuenta Google del dominio, como horas).

---

## 1. Hallazgos

### 1.1 Mitigado en la nueva infraestructura, a verificar HOY en Cloud

| ID | Sev. | Hallazgo | Evidencia | Estado on-prem |
|---|---|---|---|---|
| G-01 | **Crítico** | gestion: con el registro abierto, cualquiera se registra con la anon key (pública en el bundle) mandando `{"data":{"rol":"admin"}}` y el trigger le crea un perfil **admin** | `supabase/migrations/0002_functions.sql:46` toma el rol de `raw_user_meta_data` (lo controla el usuario); `supabase/config.toml:176,226` tiene `enable_signup=true` y `enable_confirmations=false` | **Mitigado**: `GOTRUE_DISABLE_SIGNUP=true` (probado: signup → 422). Corregir igual el trigger. **Cloud (2026-10-28): sigue abierto** (`disable_signup=false`), atenuado porque Cloud exige confirmar el email. Sin indicios de abuso |
| H-01 | **Crítico** | horas: si el proveedor email está habilitado, alguien se registra con email y contraseña usando el email de un usuario de la whitelist (p. ej. un super_admin) y el trigger le da ese rol, sin pasar por Google | `supabase/migrations/0001_schema_inicial.sql:262-299` (`handle_new_user` no mira el proveedor ni `email_confirmed_at`) | **Mitigado**: proveedor email apagado (probado: "Email signups are disabled"). Corregir igual el trigger |

> **Acción inmediata en Supabase Cloud (antes del corte):**
> - **gestion:** *Authentication → Sign In / Providers → "Allow new users to sign up" = OFF.*
> - **horas:** proveedor **Email = OFF** (sólo Google).
> - Correr `scripts/relevar-origen.sh` y revisar la sección *SEGURIDAD*. Un admin que nadie
>   creó, o una identidad `email` en horas, indica que el agujero ya se usó.

### 1.2 gestion-proyectos (Next 16.2.10 + Supabase)

| ID | Sev. | Hallazgo | Evidencia | Modo de falla | Corrección |
|---|---|---|---|---|---|
| G-02 | Alto | Desactivar un usuario no le corta el acceso, y puede reactivarse solo | `0004_rls.sql:41-44`: el `WITH CHECK` fija `rol` pero no `activo`; las políticas de lectura (`0004_rls.sql:38-170`) no miran `activo` | `PATCH /rest/v1/profiles?id=eq.<propio>` con `{"activo":true}`; aun inactivo sigue leyendo y tildando | Trigger guard sobre `rol`/`activo` como el de horas (`0001_schema_inicial.sql:334-349`), `is_activo()` en las políticas, `ban_duration` en GoTrue |
| G-03 | Alto | Contraseñas reales versionadas, la misma para dos usuarios, y el script las vuelve a poner en cada corrida | `scripts/crear-usuarios.ts:32-42`, `:68-72` | Quien tenga el repo entra como esos usuarios | Rotar ya; datos de alta desde un archivo no versionado; gitleaks en el historial |
| G-04 | Medio | El operador puede editar cualquier columna, no sólo el estado | `0004_rls.sql:97-98, 107-108, 124-125, 138-139` (`using (true) with check (true)`); autoría falsificable en `0002_functions.sql:329, 351, 373` (`coalesce(new.x, auth.uid())`) | Por API cambia textos, mueve ítems entre pasos o proyectos, edita comentarios ajenos y firma cierres como otro | Trigger `BEFORE UPDATE` que, si no es admin, sólo permita cambiar estado y fuerce `*_por := auth.uid()` |
| G-05 | Medio | Funciones SECURITY DEFINER que cualquiera puede llamar, sin chequeo de rol | `0002_functions.sql:129, 205, 239`; `0010_recordatorios_dias_y_sync_pisos.sql:55, 83, 154` | Un operador (o un anónimo, antes del parche) llama `rpc/sincronizar_pisos_proyecto` o `instanciar_plantilla`, que son acciones de admin | **Parcial on-prem**: `post-restore.sql` revoca EXECUTE a `anon` (probado). Falta `if not is_admin() then raise` adentro |
| G-06 | Medio | Open redirect en el login | `src/app/login/actions.ts:51` sólo chequea `startsWith("/")` y `!startsWith("//")`: `/\evil.com` pasa | Tras un login real, el usuario termina en un sitio de phishing | `new URL(redirect, base).origin === base.origin` |
| G-07 | Medio | pdf.js con ejecución de JavaScript al abrir un PDF malicioso | `pdfjs-dist` 5.6.205 (GHSA-hq66-cqwq-w95j, corregido en 6.4.299); `src/components/infraestructura/visor-plano.tsx:51` | Un plano PDF manipulado ejecuta código en el navegador de quien lo abre. Sólo los admins suben planos | Actualizar a ≥ 6.4.299 |
| G-08 | Bajo | Errores internos de PostgREST mostrados al usuario | `src/app/(app)/proyectos/actions.ts:55, 75, 148, 199, 218`; `edificios/actions.ts` | Filtra nombres de tablas y constraints | Mapear `error.code` a mensajes propios |
| G-09 | Bajo | Inyección de fórmulas en el CSV de marcadores | `src/lib/csv.ts:16-29` | Una etiqueta `=HYPERLINK(...)` se ejecuta en el Excel de quien exporta | Anteponer `'` a celdas que empiezan con `= + - @` |
| G-10 | Bajo | Bucket `evidencias` y tabla `attachments` sin uso, pero aceptan escrituras | `0005_storage.sql` (subida con `owner = auth.uid()`); `0004_rls.sql:147-148` | Cualquier autenticado llena el disco del Storage | Quitar el bucket y las políticas, o limitarlos |
| G-11 | Bajo | Auditoría incompleta | `activity_log` sólo registra cambios de estado; se borra en cascada con el proyecto (`0001_schema.sql:272`) | No hay rastro de bajas de proyectos, edificios o planos, ni de logins | Tabla de auditoría de acciones admin, sin cascade |

Bien hecho: RLS en todas las tablas; `is_admin()` con `search_path` fijo; Server Actions con
`requerirAdmin()` y zod; nunca usa `service_role` en ejecución; buckets privados con URLs
firmadas; el middleware usa `getUser()`; el buscador sanea `.or()`; no hay `dangerouslySetInnerHTML`.

### 1.3 horas-extra (Next 14.2.7 + Supabase)

| ID | Sev. | Hallazgo | Evidencia | Modo de falla | Corrección |
|---|---|---|---|---|---|
| H-02 | Alto | Un usuario cambia su propio email y así esquiva la desactivación | Política `profiles_update_propio` en `0001_schema_inicial.sql:321-324`; el guard (`:334-349`) sólo protege `rol`/`activo`; la gestión de usuarios opera **por email** (`src/components/admin/GestionUsuarios.tsx:74-75, 100-102`) | `PATCH profiles` con otro email: "Desactivar" ya no lo encuentra y conserva el acceso. Además desvía los mails del cron | El guard también bloquea `email`, `nombre_suaf` y `avatar_url`; operar por `id`; `is_habilitado()` que mire `allowed_emails` |
| H-03 | Alto | Super_admin sembrado con un email de **otro dominio** (Jujuy) | `0001_schema_inicial.sql:465-467` (`jefa.area@justiciajujuy.gob.ar`, `on conflict ... activo = true`) | En cualquier base nueva (incluida la on-prem) quien controle esa casilla entra como super_admin. Probado en laboratorio: aparece en la whitelist | Sacar el seed de la migración; borrar la fila en Cloud y on-prem si no corresponde |
| H-04 | Alto | Next 14.2.7 con advisories que aplican self-hosted | `package.json` (CVE-2025-29927 bypass de middleware; GHSA-4342-x723-ch2f SSRF por redirect del middleware; optimizador de imágenes; DoS de Server Components). Corregido en 14.2.35 | Bypass del control de whitelist (atenuado: los layouts y la RLS vuelven a verificar; no se logró explotar en laboratorio), DoS, SSRF | **Parcial on-prem**: el proxy elimina `x-middleware-subrequest` y bloquea `/_next/image`. Actualizar a ≥ 14.2.35 y planificar el salto a 16 |
| H-05 | Medio | Cualquier empleado ve los viáticos y datos personales de todos | `0003_tareas_por_dia.sql:64-66` (select con `is_habilitado()`); columnas de montos en `0008_viaticos_por_asignacion.sql:15-19`; consultadas en `src/app/(app)/page.tsx:110` y `src/components/calendario/Calendario.tsx:64` | Con DevTools ve montos de viático, peaje y hotel, más email, legajo y cargo de sus compañeros | Viáticos en una tabla sólo para admin; vista con columnas limitadas para los usuarios |
| H-06 | Medio | El envío de mails acepta cualquier destinatario y contenido, sin límites | `src/app/api/notificaciones/enviar/route.ts:32-49` | Con una sesión de admin robada se manda phishing desde la casilla institucional o se agota la cuota de Brevo (300/día) | Recibir `user_ids` y resolver los emails en el servidor; zod con topes; rate limit |
| H-07 | Medio | Open redirect en el callback de OAuth | `src/app/auth/callback/route.ts` (`redirect(\`${origin}${next}\`)` con `next` del query) | `next=@evil.com` o `next=.evil.com` arma un host ajeno. Es difícil de explotar por PKCE | Aceptar `next` sólo si empieza con `/`, no con `//` y sin `\`. Probado: detrás del proxy `origin` sale correcto |
| H-08 | Medio | xlsx 0.18.5 lee archivos externos | `src/components/admin/viaticos/Viaticos.tsx:107` (`XLSX.read`). GHSA-4r6h-8v6p-xvw6 (prototype pollution) y GHSA-5pgg-2g8v-p4x9 (ReDoS); **npm no tiene versión corregida** | Un Excel manipulado (el reporte SUAF) ejecuta prototype pollution o cuelga el navegador del admin | Instalar desde `cdn.sheetjs.com` (≥ 0.20.2) o pasar a exceljs, que ya es dependencia |
| H-09 | Medio | El recordatorio semanal puede hablar de la semana equivocada y depende de la zona horaria | `src/app/api/cron/recordatorio-semanal/route.ts:114` (domingo 23:00 UTC → semana ISO que termina); `:121, 147-148` (`new Date('AAAA-MM-DD')`) | Mails con fechas corridas | **On-prem**: las imágenes corren en UTC como en Vercel. Confirmar con el área qué semana espera; usar `parseISO` y TZ explícita |
| H-10 | Bajo | Varios | CSV con fórmulas (`src/components/admin/metricas/exportar.ts:39-41`, `Viaticos.tsx:133`); `avatar_url` editable como píxel de rastreo (`src/components/ui/avatar.tsx:28-35`); OAuth pide `access_type: offline` + `prompt: consent` sin necesitarlo (`src/app/(auth)/login/boton-google.tsx:16`); errores SMTP al cliente (`notificaciones/enviar/route.ts:57-59`); `notifications_log` guarda sólo el primer cuerpo; secreto del cron comparado con `!==` (`route.ts:109`) | — | Ver plan, fase 4 |

Bien hecho: RLS en todas las tablas; `signups` sin UPDATE/DELETE; RPC con `search_path` fijo
y validación de rol interna; las Route Handlers revalidan sesión y rol; `service_role` sólo
después de verificar admin o `CRON_SECRET`; mails en texto plano y el masivo en BCC.

### 1.4 bocas (Next 16.1.6, todo en el navegador)

| ID | Sev. | Hallazgo | Evidencia | Modo de falla | Corrección |
|---|---|---|---|---|---|
| B-01 | **Crítico** | `/admin` no tiene control de acceso | `app/admin/page.tsx:1` (`'use client'`, carga al montar en `:49`); el "login" sólo hace `router.push` (`app/login/page.tsx:14-21`) | Escribir `/admin` en la URL da acceso total: alta, edición y baja de bocas y bienes, y exportación | Autenticación real del lado servidor + middleware que proteja `/admin` |
| B-02 | **Crítico** | Contraseña de administración en el código del navegador | `app/login/page.tsx:17` | Visible en los JS públicos de `/_next/static` | Eliminar; rotarla si se reutiliza en otro sistema |
| B-03 | **Crítico** | La página pública `/cargar` y la API permiten escribir y **borrar** todo | `components/FormularioCarga.tsx:119, 143, 163, 243`; `components/EditarBocaModal.tsx:57, 75`; anon key en `src/lib/supabase.ts:3-4` | Con la URL y la anon key del bundle: `DELETE /rest/v1/bocas?id=gt.0` borra la tabla entera | Escrituras en route handlers / server actions con sesión; RLS con `anon` sólo lectura o nada |
| B-04 | Medio | Tope de 1000 filas de PostgREST | `app/admin/page.tsx:61`; `components/FormularioCarga.tsx:60, 110` | Con más de 1000 bocas desaparecen edificios del admin y el chequeo de duplicados falla | **On-prem**: `PGRST_DB_MAX_ROWS=10000`. Paginar en el código |
| B-05 | Bajo | Duplicados posibles (el chequeo es sólo en el cliente), sin validación de dominio, errores ignorados o mostrados crudos | `FormularioCarga.tsx:110-117`; `admin/page.tsx:189-190, 116, 184` | Datos inconsistentes | Constraint `UNIQUE`, CHECK de dominios, manejo de errores |
| B-06 | Bajo | xlsx 0.18.5 sin corregir | `package.json` | Hoy no es explotable: sólo **exporta** (`admin/page.tsx:168-171`). Sube a Medio si se agrega importación | Igual que H-08 |

### 1.5 inasistencias (Express 5)

| ID | Sev. | Hallazgo | Evidencia | Modo de falla | Corrección |
|---|---|---|---|---|---|
| I-01 | **Crítico** | La identidad y el rol los manda el navegador en headers y el servidor les cree | `server/routes/usuarios.routes.js:6-19`; `server/routes/solicitudes.routes.js:32-53`; el login no emite sesión (`server/routes/auth.routes.js:25`) | Con `curl` y `x-user-role: verificador` se aprueban o rechazan solicitudes ajenas (`solicitudes.routes.js:775-845`) y se lee el historial de todos con motivos (posibles **datos de salud**, `:425, :455`). Con `x-user-role: administrador` se listan usuarios y se crean verificadores (`usuarios.routes.js:118-157`). Con `x-user-usuario: <víctima>` se le cambia el usuario de login sin contraseña (`:36-105`) | Sesión del lado servidor (cookie HttpOnly/Secure/SameSite) o JWT firmado; rol y usuario tomados de la sesión |
| I-02 | Alto | Comentarios de solicitudes sin ningún control | `solicitudes.routes.js:516` (sin middleware) | Sin ningún header se leen los comentarios de cualquier solicitud recorriendo ids | Middleware de sesión + chequeo de pertenencia |
| I-03 | Alto | Contraseñas en texto plano | Alta `usuarios.routes.js:144`, comparación `auth.routes.js:17`, cambio `usuarios.routes.js:63, 72` | Cualquier lectura de la tabla (backup, dump, DBA) expone todas las claves, que suelen reutilizarse | argon2id/bcrypt; rehash al próximo login o reseteo forzado |
| I-04 | Alto | Login sin límite de intentos | `auth.routes.js:14-18`; mínimo de 6 caracteres sin complejidad (`usuarios.routes.js:125`) | Fuerza bruta sin freno | Rate limit (app o proxy) y bloqueo progresivo |
| I-05 | Alto | Pérdida silenciosa de datos por escrituras concurrentes | `server/utils/data-store.js:132-151` (upsert del array completo); IDs `Math.max+1` (`usuarios.routes.js:142`; `solicitudes.routes.js:620-626, 737-743`) | Dos altas simultáneas obtienen el mismo id y la segunda **pisa** a la primera; una escritura con el array viejo revierte cambios de otros | Insert/update de una fila, IDs de la base, transacciones |
| I-06 | Medio | XSS almacenado en el encabezado | `public/js/header.js:45` (`${userName}` en `innerHTML`) | Combinado con I-01: se cambia el nombre de un verificador por `<img onerror=...>` y el script corre en su navegador | `textContent` / `escapeHtml`, que ya se usa en el resto |
| I-07 | Medio | CORS abierto a cualquier origen | `server/server.js:25` (`cors()`) | Un sitio externo que visite un empleado puede llamar a la API interna desde su navegador y leer las respuestas | Quitar CORS (front y API comparten origen) |
| I-08 | **Alto** (era Medio) | El servidor usa la anon key: `anon` tiene lectura y escritura sobre todas las tablas, incluidas las contraseñas. **Confirmado en Cloud** (S-03): RLS desactivada en las 4 tablas | `data-store.js:67` | Si la anon key se filtra, cae la base completa | **Mitigado on-prem**: PostgREST sólo en la red interna del stack (probado: no resoluble desde afuera). Usar `service_role` o Postgres directo |
| I-09 | Medio | Test desactualizado que **modifica la base real** | `tests/dashboard.test.js:48-60` (aprueba la solicitud 1), `:43`, `:96` | Correr los tests con un `.env` presente altera producción | Base de test aislada y fixtures |
| I-10 | Bajo | Varios | Guard de pantallas sólo en el cliente (`public/js/admin.js:13-15`, `sessionStorage`); `.gitignore` sólo cubre `.env` (`.gitignore:2`); sin topes de largo en textos (`solicitudes.routes.js:586, 670, 812`); sin headers de seguridad propios; `X-Powered-By` | — | Ver plan, fase 4 |

Bien hecho: ninguna respuesta devuelve `password`; mensajes de login genéricos; cambio de
clave con la anterior y complejidad; validación de estados, fechas y motivos; `escapeHtml`
usado de forma consistente salvo en I-06; Express 5 captura errores async.

### 1.6 oficinas-judiciales (Next 16.0.7)

| ID | Sev. | Hallazgo | Evidencia | Modo de falla | Corrección |
|---|---|---|---|---|---|
| O-01 | Alto | Formulario público sin límites que envía mails | `app/actions.ts:6-10` (sin rate limit, captcha ni validación de largo) | Un script lo invoca miles de veces: llena la casilla y agota o hace suspender la cuenta de Resend | Rate limit, validación de largo y campos, captcha |
| O-02 | Alto | Los reportes institucionales van a un **Gmail personal** desde el remitente de prueba de Resend | `app/actions.ts:14-15` | Datos institucionales en una cuenta privada; si se cambia el destinatario, `onboarding@resend.dev` deja de entregar | `MAIL_FROM`/`MAIL_TO` por entorno con dominio verificado, o relay SMTP del PJ |
| O-03 | Medio | Inyección de HTML en el mail | `app/actions.ts:16-22` (campos interpolados sin escapar en `html` y `subject`) | Cualquiera manda un mail "oficial" con links de phishing | Escapar o mandar `text` |
| O-04 | Medio | Falsos "enviado" | `app/actions.ts:13-27` (ignora `error` de Resend, el `catch` no loguea); `new Resend(undefined)` si falta la key (`:4`) | El usuario cree que reportó y el mail nunca salió | Revisar `error`, loguear, validar la config al arrancar |
| O-05 | Bajo | Varios | `@vercel/analytics` (`app/layout.tsx:5, 27`); `data/office.ts` publica la ubicación de áreas técnicas (sin datos personales) | — | Quitar analytics; evaluar el dataset si se publica fuera de la red interna |

### 1.7 Transversal

| ID | Sev. | Hallazgo | Evidencia | Corrección |
|---|---|---|---|---|
| T-01 | Alto | Next.js con advisories críticas y altas en las 4 apps Next | `npm audit` 2026-10-26: gestion 2 críticas / 16 altas; bocas 1 / 13; oficinas 1 / 11; horas 1 / 5. Corregido en next **16.4.3** (16.x) y **14.2.35** (14.x). Las críticas son RCE en `/_next/image` (SVG/AVIF), `use cache` y `next/og`: **ninguna app usa esas funciones** | **Parcial on-prem**: el proxy bloquea `/_next/image`. Actualizar Next en las 4 apps antes de exponerlas |
| T-02 | Medio | Otras dependencias vulnerables | zod < 4.6.6 (gestion, DoS de memoria); nodemailer ≤ 10.1.3 (horas, parsing de direcciones); body-parser/qs/proxy-addr transitivas de express (inasistencias); resend ≤ 6.12.2 (oficinas) | `npm update` + `npm audit` en CI |
| T-03 | Medio | Sin encabezados de seguridad en las apps | `next.config.*` sin `headers()`; Express sin helmet | **On-prem**: el proxy agrega HSTS, `X-Frame-Options`, nosniff, `Referrer-Policy` y `Permissions-Policy`, y quita `X-Powered-By`. Pendiente: CSP por app |
| T-04 | Medio | Proceso: sin CI, sin `npm audit`, sin tests de autorización (RLS por rol), sin esquema versionado en bocas e inasistencias, historial no revisado | No hay `.github/`; bocas e inasistencias no tienen migraciones; repos recibidos sin `.git` | Ver plan, fase 5 |

### 1.8 Plataforma Supabase Cloud (verificado el 2026-10-28)

Relevamiento de sólo lectura con la Management API, sobre los proyectos de gestion e
inasistencias. horas-extra y bocas no estaban en la organización del token. Evidencia
completa en [RELEVAMIENTO-SUPABASE-CLOUD.md](RELEVAMIENTO-SUPABASE-CLOUD.md#5-hallazgos-nuevos-s-01-a-s-11).

| ID | Sev. | Hallazgo | Corrección |
|---|---|---|---|
| S-01 | Alto | Los proyectos pertenecen a una cuenta Gmail (Owner) sin MFA; ningún miembro tiene MFA | MFA; Owner institucional; transferir a una organización del PJ |
| S-02 | Alto | Plan Free: sin backups ni PITR, pausa por inactividad, logs de ~1 día | Dump lógico inmediato y cifrado; no demorar la migración |
| S-03 | Alto | inasistencias: RLS desactivada y `anon` con CRUD. Con la anon key se leen 38 contraseñas en texto plano y 125 solicitudes (17 de salud) | `service_role` en la variable de Vercel + RLS activada sin políticas `anon` (no requiere cambiar código) |
| S-04 | Medio | Datos personales y de salud alojados en EE.UU. (inasistencias) y Brasil (gestion) | Que lo valore el área legal (Ley 25.326); la migración lo resuelve |
| S-05 | Medio | gestion: los 3 usuarios son admin y uno nunca entró | Revisar los roles con el PJ; dar de baja la cuenta sin uso |
| S-06 | Medio | G-05 confirmado: 24 funciones SECURITY DEFINER ejecutables con la anon key | En Cloud, el mismo `revoke` de `post-restore.sql` |
| S-07 | Bajo | gestion: `notas` y `reminders` con grants completos a `anon` (la RLS los bloquea) | **On-prem**: revocado en `post-restore.sql` |
| S-08 | Bajo | Auth sin endurecer: contraseña de 6 caracteres, sin timeout de sesión ni captcha; registro abierto en inasistencias sin uso | Apagar el registro; endurecer GoTrue on-prem |
| S-09 | Bajo | La base acepta conexiones sin SSL y desde cualquier IP | SSL enforcement; restricción de red |
| S-10 | Bajo | Rendimiento: FK sin índice y políticas duplicadas (advisors) | Índices y unificación de políticas en el repo |
| S-11 | Bajo | Keys legacy JWT sin vencimiento práctico | On-prem usa claves nuevas; rotar o dar de baja en Cloud tras el corte |

---

## 2. Plan de corrección por fases

Cada fase se trabaja como un issue, una rama y un PR por repo.

### Fase 0 — Inmediato (esta semana, en Supabase Cloud, antes del corte)

1. gestion: deshabilitar el registro (G-01). horas: apagar el proveedor Email (H-01).
2. Correr `scripts/relevar-origen.sh` y revisar la sección *SEGURIDAD*. Investigar cualquier
   admin no reconocido, identidad `email` en horas o perfil con email cambiado.
3. Borrar `jefa.area@justiciajujuy.gob.ar` de `allowed_emails` si no corresponde (H-03).
4. Rotar las contraseñas de `scripts/crear-usuarios.ts` (G-03) y la de bocas (B-02), donde se reutilicen.
5. Confirmar que bocas e inasistencias no queden publicadas fuera de la red interna.
6. Supabase Cloud (S-01..S-03, S-06):
   - activar MFA en las cuentas de la organización y sumar un Owner institucional;
   - tomar un dump lógico de cada proyecto, porque el plan Free no tiene backups;
   - inasistencias: `service_role` en Vercel y RLS activada;
   - gestion: el `revoke execute` de `post-restore.sql`.

### Fase 1 — Incluido en la migración (hecho por Procom, sin tocar código)

| Mitigación | Cubre | Verificado |
|---|---|---|
| `GOTRUE_DISABLE_SIGNUP=true` (gestion) | G-01 | signup → 422 |
| Proveedor email/phone apagado (horas) | H-01 | "Email signups are disabled" |
| `revoke execute ... from public, anon` en `post-restore.sql` | G-05 (parcial), RPC de horas | `anon` → 42501; con sesión → 204; RLS y Storage sin regresión |
| `revoke all on notas, reminders from anon` en `post-restore.sql` de gestion | S-07 | Pendiente: se prueba en el ensayo (Fase 3 del runbook) |
| Base, backups y claves propias en el datacenter | S-01, S-02, S-04, S-09, S-11 | Al completar el corte |
| El proxy elimina `x-middleware-subrequest` (y variantes con `_`, `aliasHeadersStrategy: delete`) | H-04 (parcial) | El header no llega al backend (eco de prueba) |
| El proxy bloquea `/_next/image` | T-01 (parcial) | 403 |
| El proxy agrega HSTS, `X-Frame-Options`, `Permissions-Policy` y quita `X-Powered-By` | T-03 (parcial) | Headers presentes en la respuesta |
| PostgREST de inasistencias sólo en la red interna | I-08 | No resoluble desde la red del proxy |
| `PGRST_DB_MAX_ROWS` 10.000 (bocas) / 100.000 (inasistencias) | B-04, I-05 (tope) | Configuración |
| Studio sólo desde `ADMIN_CIDR` + basic auth | — | 403 desde fuera |
| TZ UTC igual que Vercel | H-09 (regresión evitada) | Configuración |
| `/api/cron` bloqueado desde afuera; cron interno con secreto | — | 403 / 200 / 401 |
| Backups diarios fuera del host | — | Runbook, fase 5 |

### Fase 2 — Correcciones críticas de código (desarrollo del PJ)

| Repo | Trabajo | Hallazgos |
|---|---|---|
| inasistencias | Sesión del lado servidor; borrar `x-user-*`; middleware en todas las rutas; hash de contraseñas; rate limit de login; escrituras por fila con IDs de la base | I-01..I-05 |
| bocas | Autenticación del lado servidor; escrituras en route handlers; RLS con `anon` sin escritura; sacar la contraseña del código | B-01..B-03 |
| gestion | El trigger asigna siempre `operador`; guard de `rol`/`activo`; `is_activo()` en las políticas; quitar las contraseñas del repo | G-01..G-03 |
| horas | El trigger exige `provider = google` y `email_confirmed_at`; guard de `email`/`nombre_suaf`/`avatar_url`; quitar el seed de Jujuy | H-01..H-03 |

### Fase 3 — Dependencias

next → 16.4.3 (gestion, bocas, oficinas) y 14.2.35 (horas); pdfjs-dist ≥ 6.4.299; xlsx desde
cdn.sheetjs.com ≥ 0.20.2 o exceljs; zod ≥ 4.6.6; nodemailer y resend a la última versión;
`npm update` en inasistencias. Reconstruir con `scripts/deploy.sh` y repetir las pruebas funcionales.

### Fase 4 — Endurecimiento

G-04, G-06..G-10, H-05..H-08, H-10, I-06, I-07, I-09, I-10, O-01..O-05, S-05, S-08, S-10 y CSP por app.

### Fase 5 — Proceso

- CI por repo (GitHub Actions): `npm ci`, lint, typecheck, tests, `npm audit --omit=dev`
  con umbral alto, `permissions: contents: read` y actions fijadas por SHA.
- Tests de RLS por rol en gestion y horas (ya existe `scripts/verificar-esquema.ts` para apoyarse).
- Esquema versionado de bocas e inasistencias (exportarlo del relevamiento como migración 0001).
- Escanear el historial de los repos originales con gitleaks. Reescribir la historia queda
  **fuera del plan**: es destructivo y lo decide el PJ; rotar lo expuesto es suficiente.
- Dependabot y CODEOWNERS. Tabla de auditoría de acciones administrativas (G-11, H-10).

## 3. Verificación por fase

| Fase | Cómo se prueba | Resultado esperado |
|---|---|---|
| 0 | `curl -X POST https://<ref>.supabase.co/auth/v1/signup -H "apikey: <anon>" -d '{"email":"x@y.z","password":"Prueba-12345"}'` | 422 (gestion) / `email_provider_disabled` (horas) |
| 1 | Las pruebas del Anexo A del informe | Ver tabla de la fase 1 |
| 2 | inasistencias: `curl -H "x-user-role: verificador" .../api/solicitudes/verificador/dashboard` | 401 |
| 2 | bocas: `curl -X DELETE ".../rest/v1/bocas?id=gt.0" -H "apikey: <anon>"` | 401/403, ninguna fila borrada |
| 2 | gestion: signup con `{"rol":"admin"}` en un entorno de prueba con el registro abierto | Perfil `operador` |
| 3 | `npm audit --omit=dev` en cada repo | Sin críticas ni altas |
| 5 | Pipeline de CI en verde, con el audit como paso obligatorio | — |

## 4. Fuera del plan

- Reescribir el historial de git para borrar credenciales: destructivo y lo decide el PJ.
- SSO institucional para todas las apps: decisión de arquitectura.
- CSP estricta en inasistencias: requiere sacar los `<script>` inline de los HTML.

## Fuentes

- `npm audit --package-lock-only` sobre cada lockfile, 2026-10-26; los IDs GHSA citados en las tablas.
- OWASP Session Management y Logging Cheat Sheets; 12factor.net/config.
- Pruebas propias en el laboratorio de la migración (anexo A del informe y `docs/RUNBOOK-MIGRACION.md`).
