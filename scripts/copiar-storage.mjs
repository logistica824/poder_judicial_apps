#!/usr/bin/env node
/**
 * Copia los archivos de los buckets de Storage de Supabase Cloud al Storage
 * self-hosted, por la API REST de Storage, con la service_role de cada lado.
 * Sin dependencias (fetch de Node ≥ 18). Lo invoca scripts/migrar-storage.sh.
 *
 * Env: ORIGEN_URL, ORIGEN_KEY, DESTINO_URL, DESTINO_KEY, BUCKETS ("a b c").
 *
 * - Recorre cada bucket recursivamente y sube con x-upsert: se puede volver a
 *   correr y sólo pisa lo que ya estaba.
 * - Durante la copia saca la restricción de tipos MIME del bucket destino
 *   (p. ej. `planos` sólo acepta PDF desde 0006, pero conserva imágenes
 *   viejas) y al final la vuelve a poner.
 * - La subida deja owner en null; migrar-storage.sh lo repone desde el CSV.
 */

const { ORIGEN_URL, ORIGEN_KEY, DESTINO_URL, DESTINO_KEY } = process.env;
const BUCKETS = (process.env.BUCKETS ?? "").split(/\s+/).filter(Boolean);
if (!ORIGEN_URL || !ORIGEN_KEY || !DESTINO_URL || !DESTINO_KEY || BUCKETS.length === 0) {
  console.error("faltan ORIGEN_URL, ORIGEN_KEY, DESTINO_URL, DESTINO_KEY o BUCKETS");
  process.exit(1);
}

const auth = (key) => ({ Authorization: `Bearer ${key}`, apikey: key });
const ruta = (path) => path.split("/").map(encodeURIComponent).join("/");

async function api(base, key, metodo, path, body, headers = {}) {
  const res = await fetch(`${base}/storage/v1${path}`, {
    method: metodo,
    headers: { ...auth(key), ...headers },
    body,
  });
  if (!res.ok) throw new Error(`${metodo} ${path}: ${res.status} ${await res.text()}`);
  return res;
}

/** Lista todos los objetos (no carpetas) de un bucket, recursivo. */
async function listar(bucket, prefijo = "") {
  const objetos = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await api(ORIGEN_URL, ORIGEN_KEY, "POST", `/object/list/${bucket}`,
      JSON.stringify({ prefix: prefijo, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
      { "Content-Type": "application/json" });
    const pagina = await res.json();
    for (const e of pagina) {
      const nombre = prefijo ? `${prefijo}${e.name}` : e.name;
      // Las carpetas vienen sin id.
      if (e.id === null) objetos.push(...(await listar(bucket, `${nombre}/`)));
      else objetos.push({ nombre, mime: e.metadata?.mimetype, tamano: e.metadata?.size ?? 0 });
    }
    if (pagina.length < 1000) return objetos;
  }
}

async function copiarBucket(bucket) {
  const config = await (await api(DESTINO_URL, DESTINO_KEY, "GET", `/bucket/${bucket}`)).json();
  const permisivo = { public: config.public, file_size_limit: null, allowed_mime_types: null };
  const original = {
    public: config.public,
    file_size_limit: config.file_size_limit,
    allowed_mime_types: config.allowed_mime_types,
  };
  const putBucket = (cuerpo) => api(DESTINO_URL, DESTINO_KEY, "PUT", `/bucket/${bucket}`,
    JSON.stringify(cuerpo), { "Content-Type": "application/json" });

  const objetos = await listar(bucket);
  const total = objetos.reduce((s, o) => s + o.tamano, 0);
  console.log(`${bucket}: ${objetos.length} objetos, ${(total / 1048576).toFixed(1)} MB`);

  let ok = 0;
  const fallidos = [];
  await putBucket(permisivo);
  try {
    for (const o of objetos) {
      try {
        const res = await api(ORIGEN_URL, ORIGEN_KEY, "GET", `/object/authenticated/${bucket}/${ruta(o.nombre)}`);
        const datos = Buffer.from(await res.arrayBuffer());
        await api(DESTINO_URL, DESTINO_KEY, "POST", `/object/${bucket}/${ruta(o.nombre)}`, datos, {
          "Content-Type": o.mime ?? res.headers.get("content-type") ?? "application/octet-stream",
          "x-upsert": "true",
        });
        ok++;
        if (ok % 50 === 0) console.log(`  ${ok}/${objetos.length}`);
      } catch (e) {
        fallidos.push(`${o.nombre}: ${e.message}`);
      }
    }
  } finally {
    await putBucket(original);
  }

  console.log(`${bucket}: ${ok}/${objetos.length} copiados`);
  for (const f of fallidos) console.error(`  FALLÓ ${f}`);
  return fallidos.length;
}

let errores = 0;
for (const b of BUCKETS) errores += await copiarBucket(b);
process.exit(errores ? 1 : 0);
