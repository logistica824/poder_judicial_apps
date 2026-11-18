#!/usr/bin/env node
/**
 * Genera los secretos de un stack y los imprime como líneas de .env.
 *
 *   node scripts/generar-claves.mjs >> gestion-proyectos/.env
 *
 * ANON_KEY y SERVICE_ROLE_KEY son JWT HS256 firmados con JWT_SECRET, igual que
 * las "legacy API keys" de Supabase. Cada stack tiene que tener los suyos:
 * correr una vez por app y guardar el .env resultante en el gestor de
 * secretos del PJ. Sin dependencias: sólo node:crypto.
 */
import { createHmac, randomBytes } from "node:crypto";

const hex = (bytes) => randomBytes(bytes).toString("hex");
const b64url = (data) => Buffer.from(data).toString("base64url");

function jwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const firma = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${firma}`;
}

const JWT_SECRET = hex(32);
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 10 * 365 * 24 * 3600; // 10 años, como las keys de Supabase

const claves = {
  // Hex: sin caracteres que haya que escapar dentro de las URIs postgres://
  POSTGRES_PASSWORD: hex(24),
  JWT_SECRET,
  ANON_KEY: jwt({ role: "anon", iss: "supabase", iat, exp }, JWT_SECRET),
  SERVICE_ROLE_KEY: jwt({ role: "service_role", iss: "supabase", iat, exp }, JWT_SECRET),
  DASHBOARD_PASSWORD: hex(16),
  PG_META_CRYPTO_KEY: hex(32),
  SECRET_KEY_BASE: hex(32),
  REALTIME_DB_ENC_KEY: hex(8), // realtime exige exactamente 16 caracteres
  S3_PROTOCOL_ACCESS_KEY_ID: hex(16),
  S3_PROTOCOL_ACCESS_KEY_SECRET: hex(32),
  CRON_SECRET: hex(32),
};

console.log(`\n# ---- generado por scripts/generar-claves.mjs ${new Date().toISOString()} ----`);
for (const [k, v] of Object.entries(claves)) console.log(`${k}=${v}`);
