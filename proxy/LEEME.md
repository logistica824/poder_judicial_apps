# Proxy de borde (Traefik)

Único servicio que publica 80/443. Termina TLS con el certificado del PJ y
enruta por hostname a los stacks conectados a la red `edge`. Se despliega como el
stack `pj-proxy` de Portainer desde este repo (compose path
`proxy/docker-compose.yml`, variable `ADMIN_CIDR`), compartido por testing y producción.

| Archivo | Qué tiene |
|---|---|
| `docker-compose.yml` | Traefik + `socket-proxy` (acceso de sólo lectura a la API de Docker) |
| `Dockerfile` | Imagen `pj/traefik` con `traefik.yml` y `dinamica/` adentro (Portainer CE no monta archivos relativos) |
| `traefik.yml` | Configuración estática: entrypoints, providers, logs |
| `dinamica/tls.yml` | Certificado por defecto (`/certs`, en el host `/srv/pj/certs`) y TLS ≥ 1.2 |
| `dinamica/middlewares.yml` | Middlewares compartidos: `seguridad` (encabezados + compresión, en todas las rutas), `solo-admin` (`ADMIN_CIDR`), `bloqueado` (403) |
| `certs/` | Sólo para trabajo local; en el servidor los certificados van en `/srv/pj/certs` (ver `certs/LEEME.md`) |

Cambios: `traefik.yml` o `dinamica/` → commit → stack `pj-proxy` → **Pull and redeploy**.
`ADMIN_CIDR` → editar la variable del stack → **Update the stack**.

## Las rutas viven en cada app

El proxy no tiene una lista de apps: cada servicio que se publica lleva labels
en su propio `docker-compose.yml`, y el hostname sale de las variables del stack
(`WEB_HOST`, `API_HOST`). Agregar una app no toca el proxy. Como testing y producción
conviven, los nombres llevan `${ENTORNO}`, y por eso los labels van en **formato lista**
(en formato mapa compose no interpola las claves):

```yaml
services:
  web:
    networks: [default, edge]
    labels:
      - traefik.enable=true
      - traefik.http.services.miapp-web-${ENTORNO}.loadbalancer.server.port=3000
      - traefik.http.routers.miapp-web-${ENTORNO}.rule=Host(`${WEB_HOST:?falta WEB_HOST}`)
      - traefik.http.routers.miapp-web-${ENTORNO}.service=miapp-web-${ENTORNO}
      # Sólo si es Next.js (ver "bloqueado" en dinamica/middlewares.yml):
      - traefik.http.routers.miapp-web-${ENTORNO}-bloqueo.rule=Host(`${WEB_HOST}`) && PathPrefix(`/_next/image`)
      - traefik.http.routers.miapp-web-${ENTORNO}-bloqueo.middlewares=bloqueado@file
      - traefik.http.routers.miapp-web-${ENTORNO}-bloqueo.service=miapp-web-${ENTORNO}
```

Reglas:

- Nombres de router, service y middleware **únicos entre todas las apps y entornos**:
  `<app>-<rol>-${ENTORNO}`.
- Nombres de servicio en `edge`: ver "Reglas de diseño" en el README.
- Si dos routers del mismo host compiten, gana la regla más larga (o la de
  `priority` más alta si se declara).
- Todas las rutas pasan por `seguridad@file` y sólo por HTTPS (el puerto 80
  redirige). No hace falta declararlo en los labels.

## Verificar

```bash
docker logs pj-proxy-traefik-1 2>&1 | grep -iE 'level=(error|warn)'   # labels o archivos mal escritos
curl -skI https://<WEB_HOST>/ --resolve <WEB_HOST>:443:127.0.0.1
```

## Hacia un cluster

- **Swarm**: en `traefik.yml` el provider `docker` pasa a `swarm` (mismo
  endpoint); en las apps los labels pasan de `labels:` a `deploy.labels:`.
  Traefik corre en un nodo manager; el socket-proxy necesita además
  `SERVICES=1`, `TASKS=1` y `NETWORKS=1`. En Swarm, Portainer no sustituye
  variables de la misma forma: revisar antes los `${...}` de los composes.
- **Kubernetes**: Traefik se instala como controlador de entrada (Helm) y cada
  app declara sus rutas como `HTTPRoute` (Gateway API) o `IngressRoute`. Los
  middlewares de `dinamica/` pasan a recursos `Middleware` y el certificado a
  un `Secret` TLS.
