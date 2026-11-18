# oficinas-judiciales: Next.js 16 con output "standalone" (next.config.ts del
# repo). Basado en el Dockerfile que subió el equipo del PJ, con healthcheck,
# usuario sin privilegios y la CA opcional para redes con inspección TLS.
#
# El build necesita salida a internet: registry.npmjs.org (npm ci) y
# fonts.googleapis.com / fonts.gstatic.com (next/font descarga Inter).

FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Secret opcional "ca_build": CA de un proxy con inspección TLS. Sólo existe
# durante el RUN y no queda en la imagen. Sin secret, el build no cambia.
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=ca_build sh -c '\
    if [ -s /run/secrets/ca_build ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_build; fi; \
    npm ci --no-audit --no-fund'

COPY . .
RUN --mount=type=secret,id=ca_build sh -c '\
    if [ -s /run/secrets/ca_build ]; then \
      export NODE_EXTRA_CA_CERTS=/run/secrets/ca_build SSL_CERT_FILE=/run/secrets/ca_build \
             NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1; \
    fi; \
    npm run build'

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=UTC \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
