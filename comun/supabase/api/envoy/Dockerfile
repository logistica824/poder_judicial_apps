# Gateway Envoy de Supabase con su configuración adentro de la imagen
# (Portainer CE no monta archivos con ruta relativa en stacks desde Git).
# docker-entrypoint.sh arma lds.yaml con las keys del entorno al arrancar.
FROM envoyproxy/envoy:v1.39.1
COPY envoy.yaml cds.yaml lds.template.yaml /etc/envoy/
COPY docker-entrypoint.sh /docker-entrypoint.sh
ENTRYPOINT ["/bin/sh", "/docker-entrypoint.sh"]
