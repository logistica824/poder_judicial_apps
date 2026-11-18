# Imagen genérica para las apps Next.js del PJ (gestion-proyectos, horas-extra,
# bocas). scripts/armar-repo.sh la copia como Dockerfile en la raíz del repo de
# cada app; el stack de Portainer la construye con el repo como contexto. No
# toca next.config. (oficinas-judiciales usa la suya: output standalone.)
#
# Las NEXT_PUBLIC_* se embeben en el bundle durante `next build`, por eso son
# build args y no variables de runtime: si cambia la URL pública del API hay
# que volver a construir la imagen.

FROM node:22-bookworm-slim AS build
WORKDIR /app

ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ARG NEXT_PUBLIC_SITE_URL=""
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1

# Secret opcional "ca_build": CA del proxy para redes con inspección TLS (en Portainer
# no se pasa: ver RUNBOOK, "inspección TLS"). Sólo existe durante el RUN; no queda en la imagen.
# Si se pasa: Node/npm la suman con NODE_EXTRA_CA_CERTS y Turbopack (Next 16,
# que baja Google Fonts con su propio TLS en Rust) la usa como almacén vía
# SSL_CERT_FILE. Sin secret, el build no cambia.
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=ca_build sh -c '\
    if [ -s /run/secrets/ca_build ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_build; fi; \
    npm ci --no-audit --no-fund'

COPY . .
# `npm run build` dispara los pre-scripts del repo (p. ej. prebuild de
# gestion-proyectos, que copia el worker de pdf.js a public/). next/font/google
# descarga fuentes en este paso: también necesita salida a internet.
# Sin `npm prune --omit=dev`: con next.config.ts, `next start` necesita
# typescript (devDependency) en runtime y, si falta, intenta instalarlo al
# arrancar y se cuelga.
RUN --mount=type=secret,id=ca_build sh -c '\
    if [ -s /run/secrets/ca_build ]; then \
      export NODE_EXTRA_CA_CERTS=/run/secrets/ca_build SSL_CERT_FILE=/run/secrets/ca_build \
             NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1; \
    fi; \
    npm run build'

FROM node:22-bookworm-slim
WORKDIR /app
# TZ=UTC a propósito: es la zona en la que corrían en Vercel. Las apps que
# necesitan hora argentina la fijan en el código; horas-extra arma fechas con
# new Date('AAAA-MM-DD') y con otra TZ los rangos de semana se correrían un día.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=UTC \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000

# redirect: "manual" para no seguir el 307 al login (que consulta Supabase):
# el healthcheck mide sólo que Next responde.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
