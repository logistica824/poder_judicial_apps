# inasistencias: Express 5 + estáticos en public/. Contexto de build: la
# carpeta `inasistencias/` del repo del cliente (scripts/armar-repo.sh la copia a
# deploy/web/Dockerfile). En Vercel corría como
# función serverless (api/index.js + vercel.json); acá se ejecuta server.js directo.

FROM node:22-alpine
WORKDIR /app
# TZ=UTC: misma zona que en Vercel, para no cambiar el cálculo de fechas.
ENV NODE_ENV=production \
    TZ=UTC \
    PORT=3000

COPY package.json package-lock.json ./
# Secret opcional "ca_build": CA del proxy si la red hace inspección TLS
# (en Portainer no se pasa: ver RUNBOOK, "inspección TLS"). No queda en la imagen.
RUN --mount=type=secret,id=ca_build sh -c '\
    if [ -s /run/secrets/ca_build ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_build; fi; \
    npm ci --omit=dev --no-audit --no-fund'

COPY server ./server
COPY public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/server.js"]
