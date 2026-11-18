# Generador de los informes para el cliente

Dos documentos con docx-js y los assets de la skill de marca Procom (logos, fondo de portada,
barra de gradiente):

| Script | Documento |
|---|---|
| `migracion.mjs` | `PROCOM_Propuesta_PoderJudicialCordoba_MigracionOnPremise_<fecha>_v<N>.docx`: situación actual, arquitectura, plan de migración, requisitos |
| `seguridad.mjs` | `PROCOM_Informe_PoderJudicialCordoba_AuditoriaSeguridad_<fecha>_v<N>.docx`: hallazgos, estado on-premise / Cloud, plan de remediación |

`comun.mjs` tiene el formato compartido (portada, tablas, encabezado y pie). Las pruebas de
laboratorio de cada anexo A están en `validaciones.json` (claves `migracion` y `seguridad`).

```bash
# desde la raíz del repo; SKILL = carpeta de la skill marca-procom; SCRIPT = migracion.mjs | seguridad.mjs
MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/informe/generador:/w" -v "$SKILL:/skill:ro" -v "$PWD/docs:/docs:ro" \
  -v "$PWD/informe:/out" -w /w -e OUT=/out/PROCOM_...docx node:22-alpine \
  sh -c 'npm install --no-save docx@9.5.1 >/dev/null && node "$0"' "$SCRIPT"
```
