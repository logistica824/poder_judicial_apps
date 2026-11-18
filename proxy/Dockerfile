# Traefik con su configuración adentro de la imagen: Portainer CE no monta
# archivos con ruta relativa en stacks desde Git. Cambiar traefik.yml o
# dinamica/ = commit + redeploy del stack pj-proxy (reconstruye la imagen).
FROM traefik:v3.7.16
COPY traefik.yml /etc/traefik/traefik.yml
COPY dinamica/ /etc/traefik/dinamica/
