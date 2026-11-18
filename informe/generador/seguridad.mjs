// Informe de seguridad para el cliente. Uso (en contenedor): node seguridad.mjs
// SKILL=/skill, OUT=/out/...docx
import { p, h1, h2, vineta, numerado, nota, salto, tabla, indice, pSuave, validaciones, guardar } from "./comun.mjs";

const c = [];

c.push(...indice([
  "1. Resumen ejecutivo", "2. Alcance y metodología", "3. Resumen por aplicación", "4. Acciones inmediatas",
  "5. Hallazgos críticos y altos", "6. Dependencias con vulnerabilidades conocidas",
  "7. Mitigaciones incluidas en la nueva infraestructura", "8. Verificación en Supabase Cloud",
  "9. Plan de remediación", "10. Próximos pasos",
  "Anexo A — Pruebas de las mitigaciones", "Anexo B — Hallazgos de severidad media y baja",
]));

// 1
c.push(h1("1. Resumen ejecutivo"));
c.push(p("Se auditó el código de las **cinco aplicaciones** del Poder Judicial publicadas en Vercel y, en modo de sólo lectura, los proyectos Supabase Cloud de Gestión de Proyectos e Inasistencias. Se encontraron **57 hallazgos: 6 críticos, 16 altos, 21 medios y 14 bajos**. Los más graves:"));
[
  "En **Bocas** e **Inasistencias**, cualquier persona que llegue a la aplicación puede leer, modificar o borrar datos, o actuar como otro usuario. Bocas no controla el acceso en el servidor e Inasistencias confía en quién dice ser el navegador. Requieren cambios de código.",
  "En **Gestión de Proyectos** el registro de usuarios sigue abierto en Supabase Cloud (verificado): alguien podría crearse una cuenta de administrador. La exigencia de confirmar el email lo dificulta y no hay indicios de que se haya usado. En **Horas Extra** falta acceso para verificarlo. **En Cloud hay que cerrarlo esta semana** (sección 4).",
  "Los proyectos Supabase de Gestión e Inasistencias pertenecen a una **cuenta de Gmail sin doble factor**, en un **plan sin copias de seguridad**. En Inasistencias, las **38 contraseñas están en texto plano** y la base acepta lectura y escritura con la clave de la aplicación. Además, los datos (incluidos 17 motivos de salud) están alojados en EE.UU.",
  "Las **cuatro aplicaciones Next.js** usan versiones con vulnerabilidades críticas publicadas. Ninguna usa las funciones afectadas, pero hay que actualizarlas.",
].forEach((t) => c.push(vineta(t)));
c.push(p("La nueva infraestructura on-premise del PJ (propuesta de migración) ya incluye **14 mitigaciones** que no tocan el código y que se probaron en laboratorio (sección 7). Ningún hallazgo impide migrar; el resto se corrige con el plan de remediación por fases (sección 9)."));
c.push(nota("**Decisiones que necesita el PJ:** ejecutar las acciones inmediatas en Supabase Cloud (sección 4); definir el estándar de autenticación para Bocas e Inasistencias y no publicarlas fuera de la red interna hasta corregirlas; y aprobar el plan de remediación, estimado en **10 horas** (sección 9)."));

// 2
c.push(h1("2. Alcance y metodología"));
c.push(h2("Aplicaciones auditadas"));
c.push(...tabla(["Aplicación", "Tecnología", "Datos"], [
  ["**Gestión de Proyectos** (infraestructura de red en edificios)", "Next.js 16 + Supabase", "Usuarios con rol, edificios, proyectos, planos PDF y fotos"],
  ["**Horas Extra**", "Next.js 14 + Supabase", "Horas, viáticos y datos personales de empleados; login con Google"],
  ["**Bocas de red**", "Next.js 16 + Supabase (sólo base)", "Inventario de bocas de red por edificio"],
  ["**Inasistencias**", "Express 5 + Supabase (sólo base)", "Usuarios propios y solicitudes de ausencia, con motivos (incluye salud)"],
  ["**Oficinas Judiciales**", "Next.js 16", "Sin base; formulario público que envía mails"],
], [30, 25, 45]));
c.push(h2("Incluido"));
[
  "Revisión del código de los 5 repositorios: autenticación y autorización, reglas de acceso de la base (RLS), validación de entrada, manejo de secretos y datos personales, encabezados HTTP y procesos (tests, CI).",
  "Vulnerabilidades de dependencias con npm audit sobre cada lockfile.",
  "Relevamiento de sólo lectura de los proyectos Supabase Cloud de Gestión de Proyectos e Inasistencias (28/10/2026), con el token de administración provisto por el PJ: configuración, permisos de la base, usuarios (en forma agregada), archivos, avisos de seguridad de Supabase y registros de acceso. No se modificó nada.",
  "Pruebas en laboratorio de las mitigaciones de la nueva infraestructura (Anexo A).",
].forEach((t) => c.push(vineta(t)));
c.push(h2("No incluido"));
[
  "Proyectos Supabase de Horas Extra y Bocas: no están en la organización del token provisto. H-01 y H-03 quedan sin verificar en producción.",
  "Pruebas de intrusión sobre los sistemas productivos y revisión del historial de git: los repositorios se recibieron sin historial.",
].forEach((t) => c.push(vineta(t)));
c.push(h2("Criterio de severidad"));
c.push(p("Cada hallazgo tiene evidencia en el código (archivo y línea), un modo de falla concreto y una corrección; ese detalle técnico se entrega por separado a los equipos de desarrollo. **Crítico:** cualquiera puede leer, modificar o borrar datos o tomar cuentas sin hacer nada raro. **Alto:** riesgo real de incidente, fuga o pérdida. **Medio:** defensa en profundidad, abuso o correctitud. **Bajo:** higiene."));

// 3
c.push(h1("3. Resumen por aplicación"));
c.push(...tabla(["Aplicación", "Crítico", "Alto", "Medio", "Bajo", "Total"], [
  ["Gestión de Proyectos", "1", "2", "4", "4", "11"],
  ["Horas Extra", "1", "3", "5", "1", "10"],
  ["Bocas", "3", "0", "1", "2", "6"],
  ["Inasistencias", "1", "5", "3", "1", "10"],
  ["Oficinas Judiciales", "0", "2", "2", "1", "5"],
  ["Transversal (dependencias y procesos)", "0", "1", "3", "0", "4"],
  ["Plataforma Supabase Cloud (sección 8)", "0", "3", "3", "5", "11"],
  ["**Total**", "**6**", "**16**", "**21**", "**14**", "**57**"],
], [40, 12, 12, 12, 12, 12]));
c.push(p("Lo que está bien hecho, para no tocarlo: Gestión de Proyectos y Horas Extra tienen reglas de acceso en la base (RLS) en todas las tablas, verifican rol en el servidor y no exponen claves de administración; Inasistencias nunca devuelve contraseñas y escapa casi todo el contenido que muestra; ninguna aplicación usa HTML sin escapar en React."));

// 4
c.push(h1("4. Acciones inmediatas (esta semana, en Supabase Cloud)"));
c.push(nota("G-01 y H-01 ya están cerrados en la nueva infraestructura (probado). En producción, **G-01 está abierto** (verificado el 28/10) y H-01 no se pudo verificar. Conviene resolverlos antes de migrar: la migración copia usuarios y permisos tal como están, incluido cualquier acceso indebido."));
[
  "**Gestión de Proyectos:** en Supabase, Authentication → Sign In / Providers → desactivar \"Allow new users to sign up\". **Verificado abierto el 28/10.**",
  "**Horas Extra:** desactivar el proveedor Email y dejar sólo Google.",
  "Revisar administradores que nadie dio de alta, identidades por email en Horas Extra, el super_admin de otro dominio (H-03) y perfiles con el email cambiado (H-02).",
  "Rotar las contraseñas versionadas en los repositorios (G-03 y B-02) en cualquier sistema donde se reutilicen.",
  "Mantener Bocas e Inasistencias accesibles sólo desde la red interna hasta corregir B-01..B-03 e I-01.",
  "**Organización de Supabase** (S-01): activar el doble factor en todas las cuentas y sumar como propietaria una cuenta institucional del PJ.",
  "**Copia de resguardo inmediata** de cada base (S-02): el plan gratuito no guarda backups.",
  "**Inasistencias** (S-03): sin cambiar código, configurar la aplicación con la credencial de servidor y activar las reglas de acceso (RLS) en las 4 tablas, para que la clave actual deje de dar acceso a las contraseñas.",
  "**Gestión de Proyectos** (S-06): quitar el permiso de ejecutar funciones sin sesión, con la misma instrucción que ya aplica la nueva infraestructura.",
].forEach((t) => c.push(numerado(t)));

// 5
c.push(h1("5. Hallazgos críticos y altos"));
c.push(p("**On-premise:** estado en la nueva infraestructura del PJ. **Cloud:** estado en la producción actual (Vercel y Supabase Cloud). \"Requiere código\" significa que se corrige en la aplicación, sin importar dónde corra."));
c.push(...tabla(["ID", "Severidad", "App", "Hallazgo", "Impacto", "On-premise", "Cloud"], [
  ["G-01", "Crítico", "Gestión", "Con el registro abierto, cualquiera se crea un usuario indicando rol administrador (el rol se toma de datos que envía el propio usuario)", "Control total: edificios, proyectos, planos", "Mitigado (probado)", "**Abierto** (28/10), sin indicios de uso"],
  ["H-01", "Crítico", "Horas", "El alta por email y contraseña saltea el login de Google: alguien puede registrarse con el email de un super_admin de la lista", "Acceso de super_admin", "Mitigado: sólo Google (probado)", "Sin verificar (falta acceso)"],
  ["B-01", "Crítico", "Bocas", "La página /admin no tiene control de acceso: el login sólo redirige", "Alta, edición y baja de todo el inventario", "Requiere código", "Abierto"],
  ["B-02", "Crítico", "Bocas", "La contraseña de administración está escrita en el código que descarga el navegador", "Cualquiera la puede leer", "Requiere código y rotación", "Abierto"],
  ["B-03", "Crítico", "Bocas", "La página pública de carga y la API (con la clave pública visible) permiten modificar y borrar todo", "Una sola llamada puede borrar la tabla entera", "Requiere código", "Abierto"],
  ["I-01", "Crítico", "Inasistencias", "El servidor identifica al usuario y su rol por datos que envía el navegador", "Aprobar solicitudes ajenas, ver motivos de ausencia de todos (posibles datos de salud), crear verificadores, cambiar el usuario de otro", "Requiere código", "Abierto"],
  ["G-02", "Alto", "Gestión", "Un usuario desactivado conserva el acceso y puede reactivarse solo", "Bajas que no cortan el acceso", "Requiere código", "Abierto"],
  ["G-03", "Alto", "Gestión", "Contraseñas reales de dos usuarios versionadas en el repositorio (iguales para ambos)", "Acceso como esos usuarios", "Rotar antes del corte", "Rotar"],
  ["H-02", "Alto", "Horas", "Un usuario puede cambiarse el email y así queda fuera del alcance de \"Desactivar\"", "Bajas que no cortan el acceso; mails desviados", "Requiere código", "Abierto"],
  ["H-03", "Alto", "Horas", "La migración inicial siembra un super_admin con un email de otro Poder Judicial (Jujuy)", "Acceso de super_admin para un tercero", "Detectado por el relevamiento (probado); quitar al migrar", "Sin verificar (falta acceso)"],
  ["H-04", "Alto", "Horas", "Next.js 14.2.7 con vulnerabilidades publicadas (salteo del middleware, SSRF, DoS)", "Salteo de controles, caída del servicio", "Parcial: el proxy bloquea el salteo. Actualizar a 14.2.35", "Actualizar a 14.2.35"],
  ["I-02", "Alto", "Inasistencias", "Los comentarios de las solicitudes se leen sin ningún control", "Fuga de información", "Requiere código", "Abierto"],
  ["I-03", "Alto", "Inasistencias", "Contraseñas guardadas en texto plano", "Cualquier copia de la base expone todas las claves", "Requiere código", "**Confirmado**: 38 de 38"],
  ["I-04", "Alto", "Inasistencias", "Login sin límite de intentos y contraseñas de 6 caracteres", "Adivinación de claves por fuerza bruta", "Requiere código", "Abierto"],
  ["I-05", "Alto", "Inasistencias", "Las escrituras reescriben la tabla completa y los ids se calculan en memoria", "Pérdida silenciosa de solicitudes con usuarios concurrentes", "Requiere código", "Abierto"],
  ["I-08", "Alto", "Inasistencias", "La clave de la aplicación da acceso total a las tablas, incluidas las contraseñas (era Medio; confirmado en Cloud)", "Quien obtenga la clave lee y borra todo", "Mitigado: API sólo interna", "**Abierto** (ver S-03)"],
  ["O-01", "Alto", "Oficinas", "El formulario público envía mails sin límite ni validación", "Spam y suspensión de la cuenta de correo", "Requiere código", "Abierto"],
  ["O-02", "Alto", "Oficinas", "Los reportes van a una casilla personal de Gmail desde un remitente de prueba", "Datos institucionales fuera del PJ", "Configuración y código", "Abierto"],
  ["T-01", "Alto", "Todas (Next)", "Next.js con vulnerabilidades críticas y altas publicadas en las cuatro apps Next", "Caída, salteo de controles; las críticas no aplican al código actual", "Parcial: el proxy bloquea el optimizador. Actualizar a 16.4.3 / 14.2.35", "Actualizar a 16.4.3 / 14.2.35"],
  ["S-01", "Alto", "Supabase", "Los proyectos de Gestión e Inasistencias pertenecen a una cuenta de Gmail; ningún miembro tiene doble factor", "Quien acceda a esa casilla controla las bases", "No aplica: bases y claves propias del PJ", "**Abierto**: doble factor y propietario institucional"],
  ["S-02", "Alto", "Supabase", "Plan gratuito: sin copias de seguridad, pausa por inactividad, registros de acceso de un día", "Pérdida de datos sin recuperación; no se puede investigar un incidente pasado", "Resuelto: backup diario con copia fuera del servidor", "**Abierto**: copia inmediata"],
  ["S-03", "Alto", "Inasistencias", "Reglas de acceso (RLS) desactivadas: la clave de la app lee y modifica todo", "38 contraseñas y 125 solicitudes (17 de salud) expuestas a quien tenga la clave", "Mitigado: API sólo interna", "**Abierto**: corregible sin código (sección 4)"],
], [8, 10, 13, 24, 15, 15, 15]));
c.push(p("Los 35 hallazgos de severidad media y baja, con su corrección, están en el Anexo B."));

// 6
c.push(h1("6. Dependencias con vulnerabilidades conocidas"));
c.push(p("Resultado de npm audit sobre los lockfiles al 26/10/2026:"));
c.push(...tabla(["Aplicación", "Versión actual", "Corregida en", "Críticas / altas"], [
  ["Gestión de Proyectos", "next 16.2.10 · pdfjs-dist 5.6.205 · zod 4.4.3", "next 16.4.3 · pdfjs-dist 6.4.299 · zod 4.6.6", "2 / 16"],
  ["Horas Extra", "next 14.2.7 · xlsx 0.18.5 · nodemailer 10.0.6", "next 14.2.35 · xlsx 0.20.2 (sólo desde cdn.sheetjs.com) · nodemailer actual", "1 / 5"],
  ["Bocas", "next 16.1.6 · xlsx 0.18.5", "next 16.4.3 · xlsx 0.20.2", "1 / 13"],
  ["Inasistencias", "express 5.2.1 (dependencias internas)", "npm update", "1 / 2"],
  ["Oficinas Judiciales", "next 16.0.7 · resend 6.9.3", "next 16.4.3 · resend actual", "1 / 11"],
], [22, 30, 32, 16]));
c.push(p("Las vulnerabilidades críticas de Next.js afectan a funciones que estas aplicaciones no usan (optimizador de imágenes, generación de imágenes OG y caché de funciones). Igual se cerró el acceso al optimizador desde el proxy de la nueva infraestructura, y la actualización es la fase 3 del plan de remediación."));

// 7
c.push(h1("7. Mitigaciones incluidas en la nueva infraestructura"));
c.push(p("Sin tocar el código de las aplicaciones, la infraestructura on-premise de la migración ya cubre lo siguiente (probado en laboratorio, Anexo A):"));
c.push(...tabla(["Mitigación", "Cubre"], [
  ["Registro público deshabilitado en Gestión de Proyectos", "G-01"],
  ["Sólo login con Google en Horas Extra (email y teléfono deshabilitados)", "H-01"],
  ["Las funciones de la base no se pueden invocar sin sesión", "G-05 (parcial) y funciones de Horas Extra"],
  ["El proxy elimina el encabezado usado para saltear el middleware de Next.js", "H-04 (parcial)"],
  ["El proxy bloquea el optimizador de imágenes de Next.js (no se usa)", "T-01 (parcial)"],
  ["Encabezados de seguridad: HSTS, anti-clickjacking, Permissions-Policy, sin X-Powered-By", "T-03 (parcial)"],
  ["La base de Inasistencias y su API quedan sólo en la red interna del servidor", "I-08"],
  ["Límite de filas de la API ampliado para que Bocas e Inasistencias no pierdan registros", "B-04, I-05 (parcial)"],
  ["Consola de administración de la base sólo desde la red de administración y con contraseña", "—"],
  ["Zona horaria igual a la de Vercel (UTC) para no alterar el cálculo de fechas", "H-09"],
  ["Recordatorio semanal sólo invocable desde dentro del servidor y con clave", "—"],
  ["Backups diarios con copia fuera del servidor", "S-02"],
  ["Permisos sobrantes de la clave pública sobre notas y recordatorios de Gestión revocados", "S-07"],
  ["Bases, claves y copias de seguridad propias en el datacenter del PJ, sin depender de cuentas externas", "S-01, S-04, S-09, S-11"],
], [70, 30]));

// 8
c.push(h1("8. Verificación en Supabase Cloud (28/10/2026)"));
c.push(p("Con el token de administración provisto por el PJ se relevaron, en modo de sólo lectura, los proyectos de **Gestión de Proyectos** e **Inasistencias**. Horas Extra y Bocas están en otra cuenta y quedan pendientes."));
c.push(...tabla(["", "Gestión de Proyectos", "Inasistencias"], [
  ["Región", "São Paulo (Brasil)", "Ohio (EE.UU.)"],
  ["Propietario", "Organización de una cuenta de Gmail, plan gratuito, sin doble factor (S-01, S-02)", "Misma organización"],
  ["Usuarios", "3, todos administradores, del dominio del PJ; uno nunca ingresó (S-05)", "Tabla propia con 38 contraseñas en texto plano (I-03)"],
  ["Reglas de acceso (RLS)", "Activas en las 18 tablas", "**Desactivadas** en las 4 tablas (S-03)"],
  ["Registro de usuarios nuevos", "**Abierto** (G-01)", "Abierto, sin uso (S-08)"],
  ["Funciones sin sesión", "24 invocables (S-06)", "—"],
  ["Datos sensibles", "Planos de infraestructura de red", "125 solicitudes, 17 con motivos de salud (S-04)"],
], [24, 38, 38]));
c.push(p("No se encontraron indicios de uso indebido en los registros disponibles, que en el plan gratuito abarcan sólo el último día."));

// 9
c.push(h1("9. Plan de remediación"));
c.push(p("Las fases se ordenan para proteger primero lo que hoy está en producción. Cada fase se trabaja como un issue, una rama y un cambio revisado por repositorio."));
c.push(...tabla(["Fase", "Qué se hace", "Hallazgos", "Responsable", "Horas"], [
  ["0. Inmediato", "Registro y proveedor email desactivados en Cloud; revisar usuarios y whitelist; rotar contraseñas versionadas; no publicar Bocas e Inasistencias fuera de la red interna; doble factor y propietario institucional en Supabase; copia de resguardo; reglas de acceso en Inasistencias", "G-01, H-01, H-03, G-03, B-02, S-01..S-03, S-06", "PJ con apoyo de PROCOM", "1"],
  ["1. Migración", "Mitigaciones de infraestructura de la sección 7", "Ver sección 7", "PROCOM IT SOLUTIONS", "En la migración"],
  ["2. Código crítico", "Inasistencias: sesión en el servidor, contraseñas con hash, límite de intentos, escrituras por registro. Bocas: autenticación en el servidor y escrituras protegidas. Gestión y Horas: reglas de alta y de perfil en la base", "B-01..03, I-01..05, G-01..02, H-01..03", "PROCOM IT SOLUTIONS", "5"],
  ["3. Dependencias", "Actualizar Next.js, pdf.js, xlsx, zod, nodemailer, resend y express; reconstruir y repetir pruebas", "T-01, T-02, H-04, G-07, H-08", "PROCOM IT SOLUTIONS", "2"],
  ["4. Endurecimiento", "Open redirects, permisos por columna, viáticos visibles, límites del envío de mails, formulario de Oficinas, CORS, XSS, CSV, CSP, roles de Gestión, autenticación", "Anexo B", "PROCOM IT SOLUTIONS", "1"],
  ["5. Proceso", "CI con lint, tests y npm audit obligatorio; tests de permisos por rol; esquema versionado de Bocas e Inasistencias; escaneo de secretos del historial; auditoría de acciones de administración", "T-04, G-11, I-09", "PROCOM IT SOLUTIONS", "1"],
  ["**Total**", "", "", "", "**10**"],
], [13, 40, 17, 20, 10]));
c.push(h2("Verificación"));
[
  "**Fase 0:** un intento de registro contra Supabase Cloud devuelve error en ambas apps.",
  "**Fase 2:** las llamadas con identidad falsa (Inasistencias) o sin sesión (Bocas) devuelven 401 y no modifican datos.",
  "**Fase 3:** npm audit sin vulnerabilidades críticas ni altas en las cinco apps.",
  "**Fase 5:** pipeline de CI en verde con el audit como paso obligatorio.",
].forEach((t) => c.push(vineta(t)));
c.push(h2("Fuera del plan (decisión del PJ)"));
[
  "Reescribir el historial de git para borrar credenciales: es destructivo; alcanza con rotarlas.",
  "Inicio de sesión único (SSO) institucional para todas las aplicaciones: decisión de arquitectura.",
].forEach((t) => c.push(vineta(t)));

// 10
c.push(h1("10. Próximos pasos"));
c.push(...tabla(["#", "Acción", "Responsable", "Horas"], [
  ["1", "Acciones inmediatas en Supabase Cloud (sección 4)", "PJ con apoyo de PROCOM", "1"],
  ["2", "Definir el estándar de autenticación para Bocas e Inasistencias", "PJ", "Antes del inicio"],
  ["3", "Dar acceso a Supabase de Horas Extra y Bocas para verificar H-01 y H-03 en producción", "PJ", "Antes del inicio"],
  ["4", "Correcciones de código críticas (fase 2)", "PROCOM IT SOLUTIONS", "5"],
  ["5", "Actualización de dependencias (fase 3)", "PROCOM IT SOLUTIONS", "2"],
  ["6", "Endurecimiento y proceso (fases 4 y 5)", "PROCOM IT SOLUTIONS", "2"],
  ["", "**Total del proyecto**", "", "**10**"],
], [6, 50, 26, 18]));
c.push(pSuave("Las horas son estimadas y no incluyen los tiempos de espera a cargo del PJ. Las fases 2 a 5 son independientes de la migración y se pueden ejecutar antes o después del corte."));

// Anexo A
c.push(salto());
c.push(h1("Anexo A — Pruebas de las mitigaciones"));
c.push(p("Las mitigaciones de la sección 7 se probaron en un entorno de laboratorio con datos simulados. Resultados:"));
c.push(...tabla(["Prueba", "Resultado"], validaciones("seguridad"), [70, 30]));

// Anexo B
c.push(salto());
c.push(h1("Anexo B — Hallazgos de severidad media y baja"));
c.push(p("La evidencia técnica de cada uno (archivo y línea) se entrega por separado a los equipos de desarrollo."));
c.push(...tabla(["ID", "Severidad", "Hallazgo", "Corrección"], [
  ["G-04", "Medio", "Gestión: el operador puede editar cualquier columna (textos, ubicación de ítems, comentarios ajenos) y firmar cierres a nombre de otro", "Regla en la base que sólo le permita cambiar el estado y registre su usuario"],
  ["G-05", "Medio", "Gestión: funciones privilegiadas de la base invocables por cualquier usuario sin chequeo de rol", "Parcial on-prem (sin sesión, bloqueadas). Validar rol dentro de la función"],
  ["G-06", "Medio", "Gestión: el parámetro de redirección del login acepta un destino externo", "Validar que el destino sea del mismo sitio"],
  ["G-07", "Medio", "Gestión: el visor de PDF puede ejecutar código si se sube un plano manipulado (sólo suben admins)", "Actualizar pdf.js"],
  ["H-05", "Medio", "Horas: cualquier empleado ve viáticos y datos personales de todos", "Separar montos en una tabla sólo para administración"],
  ["H-06", "Medio", "Horas: el envío de notificaciones acepta cualquier destinatario y contenido sin límites", "Destinatarios resueltos en el servidor, topes y límite de envíos"],
  ["H-07", "Medio", "Horas: redirección posterior al login de Google sin validar", "Validar el destino"],
  ["H-08", "Medio", "Horas: la librería que lee el Excel de viáticos tiene vulnerabilidades sin parche en npm", "Instalar la versión corregida desde el sitio oficial o usar exceljs"],
  ["H-09", "Medio", "Horas: el recordatorio semanal puede referirse a la semana que termina y depende de la zona horaria", "Confirmar la semana esperada con el área; fechas con zona explícita"],
  ["B-04", "Medio", "Bocas: con más de 1000 registros faltan edificios en el panel y fallan los chequeos de duplicados", "Parcial on-prem (límite ampliado). Paginar"],
  ["I-06", "Medio", "Inasistencias: el nombre del usuario se muestra sin escapar en el encabezado (XSS combinable con I-01)", "Escapar como en el resto de la app"],
  ["I-07", "Medio", "Inasistencias: la API acepta llamadas desde cualquier sitio web (CORS abierto)", "Quitar CORS"],
  ["I-09", "Medio", "Inasistencias: el test existente modifica la base real si se ejecuta", "Base de test aislada"],
  ["O-03", "Medio", "Oficinas: el contenido del formulario se inserta sin escapar en el mail", "Escapar o enviar texto plano"],
  ["O-04", "Medio", "Oficinas: los errores de envío no se detectan y el usuario ve \"enviado\"", "Verificar la respuesta y registrar errores"],
  ["T-02", "Medio", "Otras dependencias vulnerables (zod, nodemailer, resend, internas de express)", "Actualizar y auditar en CI"],
  ["T-03", "Medio", "Las apps no definen encabezados de seguridad propios ni CSP", "Parcial on-prem (proxy). CSP por app"],
  ["T-04", "Medio", "Sin CI, sin auditoría de dependencias, sin tests de permisos, sin esquema versionado en Bocas e Inasistencias", "Plan, fase 5"],
  ["S-04", "Medio", "Supabase: datos personales y de salud alojados fuera del país (EE.UU. y Brasil)", "Valoración del área legal (Ley 25.326); lo resuelve la migración"],
  ["S-05", "Medio", "Gestión: los 3 usuarios son administradores y uno nunca ingresó", "Revisar roles; dar de baja la cuenta sin uso"],
  ["S-06", "Medio", "Gestión: 24 funciones privilegiadas invocables sin sesión en Cloud (confirma G-05)", "Quitar el permiso en Cloud; ya resuelto on-prem"],
  ["G-08", "Bajo", "Gestión: mensajes de error internos de la base mostrados al usuario", "Mensajes propios"],
  ["G-09", "Bajo", "Gestión: exportación CSV sin neutralizar fórmulas", "Neutralizar celdas que empiezan con = + - @"],
  ["G-10", "Bajo", "Gestión: bucket de evidencias sin uso que acepta archivos", "Quitar o limitar"],
  ["G-11", "Bajo", "Gestión: no se auditan las acciones de administración y el registro se borra con el proyecto", "Tabla de auditoría"],
  ["H-10", "Bajo", "Horas: CSV con fórmulas, avatar usable como rastreo, permisos de Google de más, errores SMTP al cliente", "Plan, fase 4"],
  ["B-05", "Bajo", "Bocas: duplicados posibles, sin validación de valores, errores ignorados o mostrados crudos", "Restricciones en la base y manejo de errores"],
  ["B-06", "Bajo", "Bocas: librería xlsx sin parche (hoy sólo exporta, no explotable)", "Actualizar antes de agregar importación"],
  ["I-10", "Bajo", "Inasistencias: control de pantallas sólo en el navegador, .gitignore incompleto, sin topes de largo", "Plan, fase 4"],
  ["O-05", "Bajo", "Oficinas: script de analítica de Vercel; publica la ubicación de áreas técnicas", "Quitar; evaluar si se publica fuera de la red interna"],
  ["S-07", "Bajo", "Gestión: la clave pública conserva permisos sobre notas y recordatorios (las reglas de acceso los bloquean)", "Revocado on-prem"],
  ["S-08", "Bajo", "Supabase: contraseñas de 6 caracteres, sesiones sin vencimiento, sin captcha; registro abierto sin uso en Inasistencias", "Endurecer la autenticación"],
  ["S-09", "Bajo", "Supabase: la base acepta conexiones sin cifrar y desde cualquier IP", "Forzar SSL y restringir la red"],
  ["S-10", "Bajo", "Supabase: índices faltantes y reglas duplicadas (rendimiento; sin impacto con el volumen actual)", "Índices y unificación de reglas"],
  ["S-11", "Bajo", "Supabase: claves de API de formato antiguo sin vencimiento", "Claves nuevas on-prem; rotar o dar de baja Cloud"],
], [7, 15, 46, 32]));

await guardar({
  titulo: "Auditoría de seguridad de las aplicaciones",
  subtitulo: "Informe de hallazgos y plan de remediación — 5 aplicaciones web y Supabase Cloud",
  fechaVersion: "28 de octubre de 2026 · Versión 1.0",
  cuerpo: c,
});
