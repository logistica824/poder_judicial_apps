# Certificados (no se versionan)

En el servidor van en **`/srv/pj/certs/`** (ruta absoluta: Portainer CE no monta
carpetas relativas del repo). Archivos que entrega el PJ:

| Archivo | Contenido |
|---|---|
| `cert.pem` | Certificado del servidor + cadena intermedia: wildcard `*.justiciacordoba.gob.ar` o SAN con los hostnames de producción y de testing (`-test`) |
| `key.pem` | Clave privada del certificado |
| `ca.crt` | Certificado de la CA raíz (e intermedias) que emitió `cert.pem` |

`ca.crt` también lo montan los contenedores web de gestion-proyectos y horas-extra
(`NODE_EXTRA_CA_CERTS`): el código de Next llama a `NEXT_PUBLIC_SUPABASE_URL`
desde el servidor y Node tiene que confiar en la CA interna. Si el certificado
es de una CA pública, `ca.crt` puede ser la misma cadena de `cert.pem`. Si falta
cuando se despliega un stack, Docker crea en su lugar una **carpeta** vacía
`ca.crt`: borrarla, copiar el archivo y redeployar.

Permisos: `chmod 644 cert.pem ca.crt`, `chmod 600 key.pem` (Traefik corre como root
dentro del contenedor y la lee igual).

Esta carpeta del repo (`proxy/certs/`) queda sólo para trabajo local
(`ca-build.crt` = CA de la inspección TLS de la red de Procom).
