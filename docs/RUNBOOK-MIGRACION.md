# Runbook de migración — Vercel + Supabase Cloud → Portainer + Traefik en el servidor del PJ

Procedimiento para mover las 5 aplicaciones al datacenter del Poder Judicial de
Córdoba. Pensado para el equipo de Procom que ejecuta y para el área de IT del PJ
que provee la infraestructura.

**Principio:** Vercel y Supabase Cloud no se modifican en ningún momento. Mientras no
se den de baja, volver atrás es reactivar lo que ya estaba.

---

## Esquema

- **Servidor:** Ubuntu 24.04 LTS con Docker Engine (Standalone) y **Portainer CE 2.45**
  (ya instalado por el PJ). Todo se construye y se levanta **en el servidor, desde
  GitHub**: nada corre en las PC del equipo.
- **Un stack de Portainer por app y por entorno**, desde el repo de la app. Testing y
  producción conviven en el mismo servidor:

| Stack | Repo | Rama | Compose path | Se actualiza |
|---|---|---|---|---|
| `pj-proxy` | `procomitsolutions/poder_judicial_apps` | `main` | `proxy/docker-compose.yml` | a mano |
| `pj-oficinas-test` / `-prod` | oficinas_judiciales | `testing` / `main` | `docker-compose.yml` | GitOps (polling 5 min) |
| `pj-bocas-test` / `-prod` | bocas | `testing` / `main` | `docker-compose.yml` | GitOps |
| `pj-inasistencias-test` / `-prod` | inasistencias | `testing` / `main` | `docker-compose.yml` | GitOps |
| `pj-gestion-test` / `-prod` | gestion-proyectos | `testing` / `main` | `docker-compose.yml` | GitOps |
| `pj-horas-test` / `-prod` | horas-extra | `testing` / `main` | `docker-compose.yml` | GitOps |

- **Traefik** (`pj-proxy`) es lo único que publica puertos (80/443). Cada app declara
  sus rutas con labels; los nombres llevan `${ENTORNO}` para que testing y producción
  no se pisen.
- **Por qué hay imágenes propias:** Portainer CE no monta archivos con ruta relativa en
  stacks desde Git ("relative path volumes" es sólo de Business Edition). Por eso las
  configuraciones (Envoy, SQL de init, Caddyfile, Traefik) van **dentro de imágenes**
  que el stack construye, y todo lo que se monta usa **rutas absolutas del host**:

| Ruta en el servidor | Qué hay |
|---|---|
| `/srv/pj/certs/` | `cert.pem`, `key.pem`, `ca.crt` del PJ (Traefik y webs Next) |
| `/srv/pj/env/<app>-<entorno>.env` | Variables de cada stack + credenciales de migración (chmod 600) |
| `/srv/pj/datos/<entorno>/<app>/` | Datos: `db/` (Postgres), `storage/` (gestion), `snippets/` (Studio) |
| `/srv/pj/procom-migracion-pj/` | Clon del repo Procom: scripts de migración y backup |
| `/srv/backups/pj/` | Backups diarios |

- **Hostnames:** producción `<app>.justiciacordoba.gob.ar` / `api-<app>.…`; testing
  `<app>-test.…` / `api-<app>-test.…`.
- **De dónde salen los archivos de deploy de cada repo:** se editan en el repo Procom
  (`<app>/docker-compose.yml`, `<app>/.env.example`, `comun/`) y se copian al repo de la
  app con `scripts/armar-repo.sh`. En el repo de la app no se editan.

---

## Fase 0 — Accesos y relevamiento (antes de tocar nada)

### 0.1 Lo que tiene que dar el cliente

| Qué | Para qué |
|---|---|
| Push en los 5 repos de GitHub (colaborador de la cuenta `logistica824` u organización) | Subir compose/Dockerfiles y crear la rama `testing` |
| **Token de GitHub de sólo lectura** (fine-grained PAT, *Contents: Read* sobre los 5 repos) para Portainer | Que Portainer clone los repos privados. Para el repo Procom, otro token de lectura de `procomitsolutions` |
| Owner/Member de Vercel (las 5 apps) | Leer variables de entorno, pausar deployments en el corte |
| Owner de cada proyecto Supabase | Connection string, `service_role`, config de Auth y Storage |
| Google Cloud Console del OAuth client de horas-extra | Redirect URIs de testing y producción |
| Cuentas Brevo (horas-extra) y Resend (oficinas) | Reusar las credenciales o reemplazarlas por el relay SMTP del PJ |
| VM Ubuntu 24.04: 8 vCPU, **24–32 GB RAM**, 200 GB SSD | Con los dos entornos son 4 Supabase completos + 4 bases simples |
| Admin de Portainer y SSH al servidor (usuario del grupo `docker`, sudo) | Crear stacks; correr scripts de migración |
| DNS interno: 16 registros A hacia la VM | Producción: `gestion`, `api-gestion`, `horas`, `api-horas`, `bocas`, `api-bocas`, `inasistencias`, `oficinas`. Testing: los mismos con `-test` |
| Certificado wildcard `*.justiciacordoba.gob.ar` (o SAN con los 16) + CA raíz | TLS en Traefik y confianza de los contenedores Next |
| Rango IP de administración | `ADMIN_CIDR`: Studio de Supabase sólo desde ahí |

### 0.2 Estado del relevamiento (al 2026-10-28)

Ver [RELEVAMIENTO-SUPABASE-CLOUD.md](RELEVAMIENTO-SUPABASE-CLOUD.md).

| App | Proyecto Supabase | Estado |
|---|---|---|
| gestion-proyectos | `xcsbtbzrejdxyrexaesy` (sa-east-1) | Hecho: 14 MB, 3 usuarios, 19 archivos (8,8 MB) |
| inasistencias | `jpvasyuneuzcyzmyitwl` (us-east-2) | Hecho: 11 MB, 4 tablas, sin Auth ni Storage |
| horas-extra | ? | Pendiente: no está en la organización del token |
| bocas | ? | Pendiente: no está en la organización del token |

### 0.3 Variables de Vercel y connection strings

- Por proyecto de Vercel: *Settings → Environment Variables* (Production). Anotar qué
  `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` usa cada app (cuántos proyectos Supabase hay).
- Por proyecto Supabase: Dashboard → **Connect** → *Session pooler* (IPv4):
  `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`.
  Va en `ORIGEN_DB_URL` del archivo del entorno (Fase 4). La contraseña no se lee por
  API; si el Owner no la tiene, se resetea en *Settings → Database* (las apps no se
  afectan: usan keys, no la contraseña). Proyectos en plan Free: si están pausados,
  restaurarlos antes del dump.

### 0.4 Acciones de seguridad inmediatas (en Cloud, antes del corte)

Detalle en [AUDITORIA-SEGURIDAD.md](AUDITORIA-SEGURIDAD.md).

1. **gestion:** *Authentication → Sign In / Providers → "Allow new users to sign up" = OFF* (G-01).
2. **horas:** proveedor **Email = OFF**, dejar sólo Google (H-01).
3. Revisar en el relevamiento: admins que nadie dio de alta (gestion), identidades `email`
   (horas), `jefa.area@justiciajujuy.gob.ar` en la whitelist (H-03), perfiles con email
   cambiado (H-02). Se investigan **antes** de migrar: el dump los copiaría.
4. Rotar las contraseñas versionadas (`scripts/crear-usuarios.ts` de gestion; la de bocas).
5. Organización de Supabase (S-01): MFA en todas las cuentas y un Owner institucional.
6. **Dump de resguardo inmediato** (S-02): plan Free sin backups. `scripts/dump.sh` apenas
   esté `ORIGEN_DB_URL`, y guardar el resultado cifrado fuera del servidor.
7. inasistencias (S-03): RLS desactivada y contraseñas en texto plano. Mitigación a decidir por el PJ.
8. gestion (S-06): correr en Cloud el `revoke execute` del comienzo de `gestion-proyectos/post-restore.sql`.

---

## Fase 1 — Preparar el servidor (una vez, por SSH)

```bash
# Docker ya viene con Portainer. Confirmar que es el paquete oficial (no snap) y la versión:
docker version --format '{{.Server.Version}}'; snap list docker 2>/dev/null && echo "OJO: Docker por snap"
docker compose version

# Portainer no tiene que ocupar 80/443 (los usa Traefik):
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -i portainer

# Zona horaria y NTP
sudo timedatectl set-timezone America/Argentina/Cordoba && sudo timedatectl set-ntp true

# Carpetas
sudo mkdir -p /srv/pj/{certs,env,datos/test,datos/prod} /srv/backups/pj
sudo chmod 700 /srv/pj/env /srv/backups/pj
sudo chown -R "$USER": /srv/pj/env

# Certificados del PJ (desde donde los entreguen)
sudo cp cert.pem key.pem ca.crt /srv/pj/certs/
sudo chmod 644 /srv/pj/certs/cert.pem /srv/pj/certs/ca.crt && sudo chmod 600 /srv/pj/certs/key.pem
openssl x509 -in /srv/pj/certs/cert.pem -noout -subject -ext subjectAltName -enddate

# Repo Procom (para los scripts de migración y backup)
git clone https://github.com/procomitsolutions/poder_judicial_apps.git /srv/pj/procom-migracion-pj

# CLI de Supabase (dump de gestion y horas): paquete .deb de
# https://github.com/supabase/cli/releases (supabase_<versión>_linux_amd64.deb)
sudo apt-get install -y ./supabase_*_linux_amd64.deb && supabase --version
```

**Red `edge`:** Portainer → *Networks* → *Add network* → nombre `edge`, driver `bridge` → *Create*.
(Equivalente: `docker network create edge`.)

**Salida a internet (egress)** que tiene que habilitar el firewall del datacenter. Probarla desde el servidor:

```bash
for u in https://github.com https://registry.npmjs.org https://registry-1.docker.io/v2/ \
         https://fonts.googleapis.com https://fonts.gstatic.com https://api.resend.com \
         https://accounts.google.com https://oauth2.googleapis.com; do
  printf '%-40s ' "$u"; curl -s -o /dev/null -w '%{http_code}\n' --max-time 10 "$u" || echo FALLA
done
timeout 5 bash -c '</dev/tcp/smtp-relay.brevo.com/587' && echo "brevo 587 ok"
```

| Destino | Quién | Cuándo |
|---|---|---|
| github.com, registry.npmjs.org, registry-1.docker.io | Portainer (clone) y builds | en cada deploy |
| fonts.googleapis.com, fonts.gstatic.com | build de las apps Next (next/font) | en cada build |
| accounts.google.com, oauth2.googleapis.com, www.googleapis.com, lh3.googleusercontent.com | GoTrue y web de horas; navegadores | operación |
| smtp-relay.brevo.com:587 (o el relay del PJ) | web de horas-extra | operación |
| api.resend.com:443 | web de oficinas-judiciales | operación |
| `*.supabase.co`, `*.pooler.supabase.com:5432` | scripts de migración | sólo durante la migración |

> **Inspección TLS:** si el firewall del PJ inspecciona TLS, `curl` de arriba da error de
> certificado y los builds fallan en `npm ci` (`SELF_SIGNED_CERT_IN_CHAIN`). Desde
> Portainer no se le puede pasar la CA al build (el compose corre dentro del contenedor
> de Portainer). Primera opción: que IT exceptúe de la inspección a los destinos de
> build. Si no se puede, hay que recrear Portainer montando `/srv/pj/certs` en la misma
> ruta y agregar a cada compose el build secret `ca_build` con
> `file: /srv/pj/certs/ca-build.crt` (los Dockerfiles ya lo soportan).

**Antes de seguir:** backup de Portainer (*Settings → General → Backup*). Sólo cubre su
configuración, no los contenedores.

---

## Fase 2 — Stack `pj-proxy` (Traefik)

### Deploy

1. Portainer → *Stacks* → *+ Add stack* → **Name:** `pj-proxy`.
2. *Build method:* **Repository**.
   - *Repository URL:* `https://github.com/procomitsolutions/poder_judicial_apps`
   - *Repository reference:* `refs/heads/main`
   - *Compose path:* `proxy/docker-compose.yml`
   - *Authentication:* ON → usuario de GitHub + token de lectura.
   - *GitOps updates:* OFF (el proxy se actualiza a mano).
3. *Environment variables* → `ADMIN_CIDR` = rango(s) de administración, separados por espacio.
4. **Deploy the stack.** El primer deploy construye la imagen `pj/traefik` (≈ 1 min).

### Cómo saber si deployó

- Portainer → *Stacks*: `pj-proxy` aparece y no dice *Limited*. Dentro, los dos contenedores en *running* y `traefik` **healthy**.
- Por SSH:
  ```bash
  docker ps --filter label=com.docker.compose.project=pj-proxy --format 'table {{.Names}}\t{{.Status}}'
  docker logs pj-proxy-traefik-1 2>&1 | grep -iE 'error|level=(error|warn)' | tail
  ```
  Sin errores de `dinamica/` ni del certificado.

### Cómo comprobar que funciona

```bash
curl -sk -o /dev/null -w '%{http_code}\n' https://127.0.0.1/          # 404: Traefik responde, todavía sin rutas
curl -s  -o /dev/null -w '%{http_code} %{redirect_url}\n' http://127.0.0.1/   # 301/308 a https://: HTTP redirige a HTTPS
echo | openssl s_client -connect 127.0.0.1:443 -servername oficinas-test.justiciacordoba.gob.ar 2>/dev/null \
  | openssl x509 -noout -subject -issuer                              # el certificado del PJ, no "TRAEFIK DEFAULT CERT"
```

Cambios posteriores: `traefik.yml` o `dinamica/` → commit en el repo Procom → stack
`pj-proxy` → **Pull and redeploy**. `ADMIN_CIDR` → editar la variable → **Update the stack**.
Certificado nuevo → reemplazar en `/srv/pj/certs` → reiniciar el contenedor `traefik`.

---

## Fase 3 — Preparar los repos de las apps (PC de Procom)

Sólo git: no se construye ni se levanta nada en la PC.

```bash
# Por cada app: clon fresco, copiar el kit, revisar, subir a main y crear testing
git clone https://github.com/<cuenta>/<repo>.git /tmp/<repo>
procom-migracion-pj/scripts/armar-repo.sh <app> /tmp/<repo>
cd /tmp/<repo> && git diff --stat && git add -A
git commit -m "Despliegue en Portainer (compose, Dockerfiles y configs de Supabase)"
git push origin main
git push origin main:testing          # primera vez: crea la rama testing igual a main
```

| App (`<app>`) | Repo | Qué agrega `armar-repo.sh` |
|---|---|---|
| `oficinas-judiciales` | `logistica824/oficinas_judiciales` | `Dockerfile` (standalone), `docker-compose.yml`, `.dockerignore`; quita el `dockerfile` en minúscula |
| `bocas` | ? | + `deploy/db/` |
| `inasistencias` | ? | `deploy/web/`, `deploy/rest-gw/`, `deploy/db/` |
| `gestion-proyectos` | ? | + `deploy/db/`, `deploy/envoy/` |
| `horas-extra` | ? | + `deploy/db/`, `deploy/envoy/` |

Todas reciben además `deploy/.env.example` y `deploy/LEEME.md`.

**Flujo de cambios desde acá:** cambios de código → PR o push a `testing` (se despliega
solo en testing) → validar → merge a `main` (se despliega solo en producción). Los
cambios de infraestructura se hacen en el repo Procom y se vuelven a copiar con
`armar-repo.sh`, primero a `testing`.

---

## Fase 4 — Testing, app por app

Orden sugerido (de menor a mayor complejidad): **oficinas → bocas → inasistencias →
gestion → horas**. oficinas es el piloto: confirma clone desde GitHub, build en el
servidor, sustitución de variables y ruteo de Traefik.

### 4.1 Procedimiento común de deploy

**a) Variables (SSH):**

```bash
cd /srv/pj/procom-migracion-pj && git pull
scripts/nuevo-entorno.sh <app> test        # crea /srv/pj/env/<app>-test.env con hostnames y secretos
nano /srv/pj/env/<app>-test.env            # completar lo que avisa ("completar a mano: ...")
scripts/vars-portainer.sh <app> test       # copiar la salida (sin ORIGEN_*)
```

Guardar una copia del archivo en el gestor de secretos del PJ. **No volver a generarlo**:
si cambian `POSTGRES_PASSWORD` o `JWT_SECRET` con la base ya creada, el stack deja de
conectar (el script se niega a pisarlo).

**b) Stack (Portainer):** *Stacks → + Add stack*

| Campo | Valor |
|---|---|
| Name | `pj-<corto>-test` (`pj-oficinas-test`, `pj-bocas-test`, `pj-inasistencias-test`, `pj-gestion-test`, `pj-horas-test`) |
| Build method | Repository |
| Repository URL | URL del repo de la app |
| Repository reference | `refs/heads/testing` |
| Compose path | `docker-compose.yml` |
| Authentication | ON: usuario + token de lectura (si el repo es privado) |
| GitOps updates | ON → *Polling*, intervalo `5m`. *Re-pull image* y *Force redeployment*: OFF |
| Environment variables | *Advanced mode* → pegar la salida de `vars-portainer.sh` |

→ **Deploy the stack.** El primer deploy construye las imágenes: 3 a 8 min según la app.

### 4.2 Cómo saber si deployó (todas las apps)

1. **Portainer → Stacks → `pj-<corto>-test`:** sin error en el deploy. Si falla, el mensaje
   aparece arriba (variable faltante `falta X`, error de build, red `edge` inexistente).
2. **Contenedores:** todos *running* y los que tienen healthcheck en **healthy**:
   ```bash
   docker ps --filter label=com.docker.compose.project=pj-<corto>-test --format 'table {{.Names}}\t{{.Status}}'
   ```
3. **Imagen nueva:** `docker images 'pj/<corto>-*'` muestra el tag `test` recién creado.
4. **Logs de la web:** Portainer → contenedor `web` → *Logs*: `Ready in …` (Next) o
   `Servidor corriendo en puerto 3000` (inasistencias), sin errores de conexión.
5. **Ruta en Traefik:** desde el servidor, sin depender del DNS:
   ```bash
   H=<app>-test.justiciacordoba.gob.ar
   curl -sk -o /dev/null -w '%{http_code}\n' --resolve $H:443:127.0.0.1 https://$H/
   ```
   `200` o `307` = OK. `404` = Traefik no tiene la ruta (revisar labels/`WEB_HOST` y
   que el contenedor esté healthy). `502/504` = la ruta existe pero la app no responde.
6. **GitOps:** stack → *Git* muestra la referencia y el último commit desplegado.

### 4.3 Cómo comprobar que funciona, por app

Para las pruebas desde una PC sin DNS de testing: entradas en `/etc/hosts`
(`C:\Windows\System32\drivers\etc\hosts`) apuntando los hostnames `-test` a la IP del servidor.

Controles de seguridad comunes (todas las apps Next):

```bash
curl -sk -o /dev/null -w '%{http_code}\n' --resolve $H:443:127.0.0.1 "https://$H/_next/image?url=/x.png&w=64&q=75"   # 403
```

#### oficinas-judiciales (`pj-oficinas-test`)

Variables a completar: `RESEND_API_KEY` (la de Vercel).

- [ ] La búsqueda devuelve oficinas (incluidas las del edificio de familia agregadas en noviembre).
- [ ] *Enviar propuesta de modificación* → el mail llega. **Ojo:** el destinatario está fijo
      en el código (una casilla Gmail, hallazgo O-02) y la app muestra "enviado" aunque
      falle (O-04): confirmar la recepción con el dueño de la casilla, y si no llega,
      revisar los logs de `web`.

#### bocas (`pj-bocas-test`)

Variables: ninguna extra (secretos generados).

- [ ] `curl -sk --resolve api-bocas-test.justiciacordoba.gob.ar:443:127.0.0.1 -H "apikey: <ANON_KEY>" "https://api-bocas-test.justiciacordoba.gob.ar/rest/v1/bocas?select=*&limit=1"` → `200` (`[]` mientras no haya datos).
- [ ] Ensayo de migración (4.4) y después: alta y edición de una boca y de un bien informático.

#### inasistencias (`pj-inasistencias-test`)

- [ ] `curl -sk --resolve inasistencias-test.justiciacordoba.gob.ar:443:127.0.0.1 https://inasistencias-test.justiciacordoba.gob.ar/api` → `200`.
- [ ] Ensayo de migración (4.4) y después: login; crear solicitud; verificarla con rol verificador; alta de usuario desde admin.

#### gestion-proyectos (`pj-gestion-test`)

Variables: SMTP del PJ (opcional). Requiere `/srv/pj/certs/ca.crt`.

- [ ] `curl -sk --resolve api-gestion-test.justiciacordoba.gob.ar:443:127.0.0.1 -H "apikey: <ANON_KEY>" https://api-gestion-test.justiciacordoba.gob.ar/auth/v1/health` → `200`.
- [ ] Studio: `https://api-gestion-test…/` desde `ADMIN_CIDR` pide usuario `admin-pj` +
      `DASHBOARD_PASSWORD`; desde otra red → `403`.
- [ ] Ensayo de migración (4.4) y después: login admin y operador; abrir un plano PDF; subir
      un plano; tildar un checklist; reporte; dashboard.

#### horas-extra (`pj-horas-test`)

Variables: `GOOGLE_CLIENT_ID`/`GOOGLE_SECRET`, `SMTP_*`. Antes: en Google Cloud Console →
OAuth client → *Authorized redirect URIs* **agregar** `https://api-horas-test.justiciacordoba.gob.ar/auth/v1/callback`.

- [ ] `…/auth/v1/health` → `200` (igual que gestion, con `api-horas-test`).
- [ ] `https://horas-test…/api/cron/recordatorio-semanal` → `403` desde afuera.
- [ ] Logs del contenedor `cron`: `cron: '0 0 31 2 *'`. En testing no corre nunca a propósito.
      Probarlo a mano: Portainer → contenedor `cron` → *Console* (`/bin/sh`):
      `curl -sS -H "Authorization: Bearer $CRON_SECRET" http://web:3000/api/cron/recordatorio-semanal`.
- [ ] Ensayo de migración (4.4) y después: login con Google de un usuario de la whitelist;
      uno fuera → `/no-autorizado`; anotarse y ver el cambio **en vivo** en otra sesión
      (Realtime); export Excel. **Mails:** con datos reales, las notificaciones llegan a
      usuarios reales: usar un SMTP de prueba o avisar antes.

### 4.4 Ensayo de migración de datos en testing (producción sigue en Vercel)

En `/srv/pj/env/<app>-test.env` completar `ORIGEN_DB_URL` (y para gestion `ORIGEN_SUPABASE_URL` + `ORIGEN_SERVICE_ROLE_KEY`). Después:

```bash
cd /srv/pj/procom-migracion-pj
scripts/relevar-origen.sh <app> test > relevamiento-<app>.txt   # sólo lectura (Fase 0)
scripts/dump.sh <app> test                 # Cloud -> dumps/<app>/<fecha>/
scripts/restore.sh <app> test              # una transacción (+ post-restore.sql en gestion/horas)
scripts/migrar-storage.sh gestion-proyectos test    # sólo gestion
scripts/validar-migracion.sh <app> test    # tiene que decir "sin diferencias"
```

**Medir el tiempo** de dump + restore + storage: define la ventana de corte.

**Repetir desde cero** (base limpia):
1. Portainer → stack → **Stop this stack**.
2. `sudo rm -rf /srv/pj/datos/test/<corto>`
3. Portainer → **Start this stack** → esperar healthy (la primera inicialización de la base tarda ~1 min).

### 4.5 Prueba de GitOps

Commit trivial en la rama `testing` del repo (p. ej. un comentario en el README) → en
≤ 5 min el stack se redespliega solo (*Git* muestra el commit nuevo; la imagen
`pj/<corto>-web:test` tiene fecha nueva). Producción no se mueve.

---

## Fase 5 — Producción (corte), app por app

Se puede hacer de a una app. oficinas no tiene datos: sólo pasos 1, 4 y 5.

### 5.1 Antes de la ventana

1. `scripts/nuevo-entorno.sh <app> prod`, completar variables (las de Vercel; para
   horas, redirect URI `https://api-horas.justiciacordoba.gob.ar/auth/v1/callback` en
   Google, **agregado** sin quitar el de Supabase Cloud).
2. Crear el stack `pj-<corto>-prod` como en 4.1, con **`refs/heads/main`**.
3. Verificar con 4.2 (hostnames sin `-test`): stack vacío pero healthy.
4. `main` tiene que tener lo mismo que se validó en `testing` (merge hecho).

### 5.2 En la ventana

1. **Aviso** a los usuarios con fecha y hora (sugerido: viernes 18 h o fin de semana).
2. **Congelar escrituras** en Vercel: *Settings → Deployment Protection* (o pausar el
   proyecto). Para horas-extra, desactivar también el cron de Vercel.
3. **Base limpia** de producción (borra lo que haya quedado de pruebas):
   Portainer → `pj-<corto>-prod` → *Stop* → `sudo rm -rf /srv/pj/datos/prod/<corto>` → *Start* → healthy.
4. **Migrar y validar**, con `ORIGEN_*` en `/srv/pj/env/<app>-prod.env`:
   ```bash
   scripts/dump.sh <app> prod && scripts/restore.sh <app> prod
   scripts/migrar-storage.sh gestion-proyectos prod      # sólo gestion
   scripts/validar-migracion.sh <app> prod               # "sin diferencias"
   ```
5. **Pruebas de humo** (4.3 con los hostnames de producción, por `/etc/hosts`).
6. **DNS:** publicar los registros de producción.
7. **Comunicar** las URLs nuevas. En gestion y horas **todos vuelven a iniciar sesión**
   (cambia el JWT secret); contraseñas (gestion) y cuentas de Google (horas) se conservan.

### 5.3 Cómo saber que producción quedó bien

- [ ] 4.2 completo para `pj-<corto>-prod`.
- [ ] `validar-migracion.sh <app> prod` sin diferencias.
- [ ] Checklist funcional de 4.3 con un usuario real de cada rol.
- [ ] Al día siguiente: primer backup en `/srv/backups/pj/prod/<app>/` (Fase 6).
- [ ] horas: el domingo 20:00 ART, logs del `cron` de `pj-horas-prod` con `<- recordatorio-semanal`.

### 5.4 Rollback

Si algo falla y no se resuelve en la ventana: quitar el DNS nuevo y reactivar el
deployment de Vercel. Supabase Cloud quedó intacto. El stack de producción se puede
dejar parado (*Stop*) hasta el próximo intento.

---

## Fase 6 — Post-migración

- **Backups:** cron de root (lee `/srv/pj/datos`):
  ```
  30 2 * * * /srv/pj/procom-migracion-pj/scripts/backup.sh >> /var/log/pj-backup.log 2>&1
  ```
  Por defecto sólo producción (`ENTORNOS="prod test"` para los dos). Definir
  `BACKUP_REMOTO` para la copia fuera del host. **Probar una restauración** en el stack
  de testing antes de dar de baja Supabase:
  ```bash
  docker exec -i pj-<corto>-test-db-1 pg_restore -U supabase_admin -d postgres --clean --if-exists \
    < /srv/backups/pj/prod/<app>/<fecha>.dump
  ```
- **Backup de Portainer** (*Settings → General → Backup*) después de crear los stacks:
  ahí quedan las variables de cada uno.
- **Monitoreo mínimo:** healthchecks y `restart: unless-stopped` configurados; logs con
  rotación (10 MB × 5). Revisar Portainer (contenedores *unhealthy*) y `/var/log/pj-backup.log`.
- **Limpieza:** borrar `ORIGEN_*` de `/srv/pj/env/*.env` y la carpeta
  `/srv/pj/procom-migracion-pj/dumps/` (datos personales); quitar el redirect URI de
  Supabase Cloud en Google.
- **Baja de Vercel y Supabase Cloud** después de ~30 días estables, con un último
  `scripts/dump.sh` guardado en el backup.

---

## Referencia rápida

| Tarea | Cómo |
|---|---|
| Estado de un stack | Portainer → Stacks → `pj-<corto>-<entorno>`, o `docker ps --filter label=com.docker.compose.project=pj-<corto>-<entorno>` |
| Logs | Portainer → contenedor → *Logs*, o `docker logs -f pj-<corto>-<entorno>-web-1` |
| Redeploy forzado (mismo commit) | Stack → **Pull and redeploy** |
| Cambiar una variable | Stack → *Environment variables* → **Update the stack** (reflejarlo también en `/srv/pj/env/`) |
| Cambió una URL pública (`NEXT_PUBLIC_*`) | Update the stack: la imagen web se reconstruye |
| Studio (desde ADMIN_CIDR) | `https://api-gestion[-test].<dom>/`, `https://api-horas[-test].<dom>/`; usuario `admin-pj` |
| psql de una base | `docker exec -it pj-<corto>-<entorno>-db-1 psql -U supabase_admin -d postgres` |
| Recargar esquema PostgREST | `docker exec pj-<corto>-<entorno>-db-1 psql -U supabase_admin -d postgres -c "notify pgrst, 'reload schema'"` |
| Alta de usuario gestion | Studio → Authentication, o `scripts/crear-usuarios.ts` del repo con `NEXT_PUBLIC_SUPABASE_URL=https://api-gestion.<dom>` |

## Problemas frecuentes

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| Deploy falla con `falta X` | Variable sin cargar en el stack | Agregarla (Advanced mode) y redeploy |
| Deploy falla con `network edge declared as external, but could not be found` | Falta la red | Fase 1: crear `edge` |
| Build falla en `npm ci` con `SELF_SIGNED_CERT_IN_CHAIN` | Inspección TLS en el firewall | Ver la nota de Fase 1 |
| Build falla en `next build` bajando fuentes | Sin salida a Google Fonts | Abrir `fonts.googleapis.com` y `fonts.gstatic.com` |
| `404` de Traefik en el hostname | Contenedor no healthy, `WEB_HOST` distinto o ruta mal escrita | Ver logs de `traefik` y el estado del contenedor |
| Traefik loguea `router … already exists` | Dos stacks con el mismo `ENTORNO` | Revisar la variable `ENTORNO` del stack |
| La base no arranca tras regenerar el `.env` | `POSTGRES_PASSWORD` distinto al de la base creada | Restaurar el archivo original del gestor de secretos, o base limpia |
| Web de gestion/horas: `fetch failed` / `unable to verify the first certificate` | Falta `/srv/pj/certs/ca.crt` (Docker creó una carpeta vacía en su lugar) | Copiar la CA, `sudo rm -rf /srv/pj/certs/ca.crt` si es carpeta, y redeploy |
| GitOps no redepliega | Token vencido o sin acceso | Stack → *Git* → actualizar credenciales; probar *Pull and redeploy* |
| "timed out for security purposes" en Portainer | Instalación nueva sin admin en 5 min | `docker restart portainer` (admin del PJ) |
