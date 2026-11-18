// Propuesta de migración para el cliente. Uso (en contenedor): node migracion.mjs
// SKILL=/skill, DIAGRAMA=/docs/arquitectura.drawio.png, OUT=/out/...docx
import { p, h1, h2, vineta, nota, salto, tabla, indice, imagen, epigrafe, pSuave, img, validaciones, guardar } from "./comun.mjs";

const DIAGRAMA = process.env.DIAGRAMA ?? "/docs/arquitectura.drawio.png";
const c = [];

c.push(...indice([
  "1. Resumen ejecutivo", "2. Alcance", "3. Situación actual", "4. Arquitectura propuesta",
  "5. Plan de migración", "6. Requisitos a cargo del PJ", "7. Próximos pasos",
  "Anexo A — Validación en laboratorio", "Anexo B — Entregables",
]));

// 1
c.push(h1("1. Resumen ejecutivo"));
c.push(p("El Poder Judicial opera hoy **cinco aplicaciones** publicadas en Vercel. Cuatro guardan sus datos en Supabase Cloud (base de datos, usuarios y archivos); la quinta no usa base de datos. Se relevó el código de los cinco repositorios y se diseñó su traslado a un **único servidor Ubuntu con Docker dentro del datacenter del PJ**, sin modificar el código de las aplicaciones."));
c.push(p("Los datos **no están en GitHub**: los repositorios tienen el código y, en dos casos, la estructura de la base. Los datos productivos (registros, cuentas de usuario y planos/fotos) están en Supabase y se migran con un procedimiento de exportación, carga y validación por conteo de filas, ensayado antes del corte. Los volúmenes relevados son chicos: el corte de cada aplicación se estima en minutos."));
c.push(p("La migración se hace **app por app, con vuelta atrás garantizada**: Vercel y Supabase no se tocan hasta 30 días después del corte. El único impacto visible para los usuarios es que, en Gestión de Proyectos y Horas Extra, tienen que volver a iniciar sesión una vez; las contraseñas y las cuentas de Google se conservan."));
c.push(p("La infraestructura se probó completa en laboratorio (Anexo A) y queda preparada para crecer: sumar aplicaciones no requiere tocar el punto de entrada, y la misma configuración sirve de base para un futuro cluster."));
c.push(p("El proyecto se estima en **10 horas** de trabajo de PROCOM IT SOLUTIONS (sección 5)."));
c.push(nota("**Decisiones que necesita el PJ:** aprobar la arquitectura (sección 4); proveer servidor, DNS, certificado y accesos (sección 6); y fijar la ventana de corte de cada aplicación."));

// 2
c.push(h1("2. Alcance"));
c.push(h2("Incluido"));
[
  "Análisis del código de los 5 repositorios entregados (gestion-proyectos, horas-extra, bocas, inasistencias, oficinas_judiciales) para identificar los servicios de Vercel y Supabase que usa cada aplicación (base de datos, autenticación, archivos, tiempo real, tareas programadas, correo).",
  "Diseño de la arquitectura destino: configuración de cada aplicación en su propio stack y herramientas de migración, backup y despliegue.",
  "Procedimiento de migración de datos con ensayo, corte, validación y vuelta atrás.",
  "Validación en laboratorio con datos simulados (Anexo A).",
  "Relevamiento de sólo lectura de los proyectos Supabase Cloud de Gestión de Proyectos e Inasistencias (28/10/2026), con el token de administración provisto por el PJ. No se modificó nada.",
].forEach((t) => c.push(vineta(t)));
c.push(h2("No incluido"));
[
  "Acceso a Vercel y a los proyectos Supabase de Horas Extra y Bocas: no están en la organización del token provisto. Su relevamiento se completa en la Fase 0.",
  "Cambios en el código de las aplicaciones.",
  "Pruebas de carga y alta disponibilidad (un solo servidor).",
].forEach((t) => c.push(vineta(t)));

// 3
c.push(h1("3. Situación actual"));
c.push(p("Cada carpeta entregada corresponde a una aplicación independiente con su propio repositorio:"));
c.push(...tabla(["Aplicación", "Tecnología", "Qué usa de Supabase / servicios", "Estructura de base en el repo"], [
  ["**Gestión de Proyectos** (infraestructura de red en edificios)", "Next.js 16", "Base + usuarios con contraseña + reglas de acceso por rol + archivos privados (planos PDF y fotos de evidencia)", "Sí (13 migraciones)"],
  ["**Horas Extra**", "Next.js 14", "Base + login con Google y lista blanca + actualización en tiempo real + mails (Brevo) + recordatorio semanal programado en Vercel", "Sí (12 migraciones)"],
  ["**Bocas de red**", "Next.js 16", "Sólo base (2 tablas), consultada directo desde el navegador", "No"],
  ["**Inasistencias**", "Express 5", "Sólo base (4 tablas), consultada desde el servidor", "No"],
  ["**Oficinas Judiciales**", "Next.js 16", "Nada: los datos están en el código. Envía mails con Resend", "—"],
], [24, 13, 43, 20]));
c.push(h2("Datos relevados en Supabase Cloud (28/10/2026)"));
c.push(p("**Gestión de Proyectos** e **Inasistencias** tienen cada una su propio proyecto Supabase, dentro de una misma organización en plan gratuito. Falta confirmar el proyecto de Horas Extra y el de Bocas; el procedimiento contempla tanto proyectos separados como compartidos."));
c.push(...tabla(["", "Gestión de Proyectos", "Inasistencias"], [
  ["Región", "São Paulo (Brasil)", "Ohio (EE.UU.)"],
  ["Tamaño de la base", "14 MB", "11 MB"],
  ["Datos", "2 proyectos, 4 edificios, 22 tareas, 1.591 ítems de checklist", "38 usuarios, 125 solicitudes (feb a nov 2026)"],
  ["Usuarios", "3, con usuarios de Supabase", "Tabla propia de la aplicación (no usa los usuarios de Supabase)"],
  ["Archivos", "19 planos PDF (8,8 MB)", "Ninguno"],
], [24, 38, 38]));
c.push(p("Las versiones de base coinciden con las de la nueva infraestructura y ninguno de los dos proyectos comparte datos con otra aplicación. Para ejecutar el ensayo sólo falta la **contraseña de la base** de cada proyecto, que el propietario puede proveer o restablecer sin afectar a las aplicaciones."));

// 4
c.push(h1("4. Arquitectura propuesta"));
c.push(p("Un servidor con Docker y **un stack docker compose por aplicación**, más un proxy de entrada compartido. Cada aplicación tiene su propia base de datos y sus propias claves: un problema en una no afecta a las demás, y cada una se puede migrar, actualizar o restaurar por separado."));
c.push(imagen(img(DIAGRAMA), 640, Math.round(640 * 1445 / 2525)));
c.push(epigrafe("Figura 1 — Arquitectura destino en el datacenter del PJ"));
c.push(h2("Componentes"));
c.push(...tabla(["Stack", "Contenedores", "Por qué"], [
  ["Proxy", "Traefik", "Único punto de entrada (443). TLS con el certificado del PJ, ruteo por nombre y encabezados de seguridad. Cada aplicación declara sus propias rutas: sumar aplicaciones no requiere tocar el proxy, y la misma herramienta sirve si la plataforma pasa a un cluster Docker Swarm o Kubernetes"],
  ["Gestión de Proyectos", "Next.js + Supabase self-hosted (Postgres, GoTrue, PostgREST, Storage, Studio)", "La app depende de usuarios, reglas por rol y archivos de Supabase: se instala la versión oficial self-hosted y el código no cambia"],
  ["Horas Extra", "Next.js + Supabase self-hosted (Postgres, GoTrue con Google, PostgREST, Realtime, Studio) + cron", "Igual que la anterior, más tiempo real; el cron reemplaza al programador de Vercel con el mismo horario"],
  ["Bocas", "Next.js + Postgres + PostgREST", "Sólo usa tablas: no hace falta el resto de Supabase"],
  ["Inasistencias", "Express + Postgres + PostgREST (internos)", "Sólo usa tablas desde el servidor: la base no queda expuesta"],
  ["Oficinas Judiciales", "Next.js", "Sin base de datos"],
], [20, 38, 42]));
c.push(h2("Supabase en el servidor del PJ"));
c.push(p("Supabase no es un programa único sino un conjunto de componentes de **código abierto** alrededor de una base PostgreSQL. En la nube los opera la empresa Supabase; en la nueva infraestructura esos mismos componentes corren en el servidor del PJ, **sin licencias ni conexión con la empresa**. Lo que se da de baja después de la migración es el servicio en la nube, no el software."));
c.push(...tabla(["Componente", "Función", "Lo usan"], [
  ["PostgreSQL", "Base de datos. Además guarda las reglas de acceso: qué filas puede ver o cambiar cada usuario", "Gestión, Horas, Bocas, Inasistencias"],
  ["GoTrue", "Usuarios, inicio de sesión y contraseñas (en Horas, login con Google). Entrega el token que identifica al usuario", "Gestión, Horas"],
  ["PostgREST", "Convierte los pedidos de la aplicación en consultas a la base, ejecutadas con los permisos del usuario", "Gestión, Horas, Bocas, Inasistencias"],
  ["Storage", "Guarda y entrega archivos (planos PDF y fotos de evidencia)", "Gestión"],
  ["Realtime", "Avisa al navegador cuando cambia un dato, para actualizar la pantalla en vivo", "Horas"],
  ["Studio", "Consola web de administración de la base, sólo desde la red de administración", "Gestión, Horas"],
  ["Gateway (Envoy)", "Recibe los pedidos a la API y los reparte entre los componentes anteriores", "Gestión, Horas"],
], [18, 57, 25]));
c.push(p("Mantener estos componentes permite migrar **sin modificar el código** de las aplicaciones. Su actualización pasa a ser parte de la operación del servidor, como cualquier otro software. A futuro, el reemplazo con más sentido es el del inicio de sesión (GoTrue) por el SSO institucional del PJ o Keycloak, que se puede hacer aplicación por aplicación."));
c.push(h2("Servidor sugerido"));
c.push(p("Ubuntu Server 24.04 LTS · **8 vCPU · 16 GB RAM · 200 GB SSD** (datos, imágenes de contenedores y backups locales). Backups diarios con copia fuera del servidor."));
c.push(h2("Direcciones"));
c.push(...tabla(["Nombre (DNS interno)", "Uso"], [
  ["gestion.<dominio>", "Gestión de Proyectos"], ["api-gestion.<dominio>", "API de Gestión (la usa el navegador) y consola de administración"],
  ["horas.<dominio>", "Horas Extra"], ["api-horas.<dominio>", "API de Horas Extra, login con Google y tiempo real"],
  ["bocas.<dominio>", "Bocas de red"], ["api-bocas.<dominio>", "API de Bocas (la usa el navegador)"],
  ["inasistencias.<dominio>", "Inasistencias"], ["oficinas.<dominio>", "Oficinas Judiciales"],
], [40, 60]));

// 5
c.push(h1("5. Plan de migración"));
c.push(p("PROCOM IT SOLUTIONS ejecuta la migración con un procedimiento operativo detallado, que se entrega con la documentación técnica (Anexo B). Resumen:"));
c.push(...tabla(["Fase", "Qué se hace", "Resultado", "Horas"], [
  ["0. Relevamiento", "Accesos, variables de Vercel, relevamiento automático (sólo lectura) de cada proyecto Supabase", "Volúmenes reales, mapa app → proyecto Supabase, ventana estimada", "1"],
  ["1. Servidor", "Instalación de Docker, usuario de despliegue, firewall, red y salida a internet", "Servidor listo", "1"],
  ["2. Stacks vacíos", "Claves por aplicación, certificados, alta del redirect de Google, despliegue de los 6 stacks", "Las 5 apps corriendo sin datos", "1"],
  ["3. Ensayo", "Exportación de Supabase, carga, copia de archivos y validación por conteo; pruebas funcionales con usuarios clave", "Procedimiento probado y tiempo de corte medido", "3"],
  ["4. Corte (por app)", "Aviso, congelamiento en Vercel, migración final, validación, DNS", "App productiva en el datacenter", "3"],
  ["5. Post-migración", "Backups programados y prueba de restauración, limpieza de credenciales temporales", "Operación estable", "1"],
  ["**Total**", "", "", "**10**"],
], [17, 45, 28, 10]));
c.push(p("Vercel y Supabase Cloud se dan de baja 30 días después del corte, una vez confirmada la operación estable."));
c.push(nota("La migración copia usuarios y permisos tal como están en Supabase Cloud. Conviene completar antes del ensayo las acciones inmediatas del **informe de seguridad**."));
c.push(h2("Vuelta atrás"));
c.push(p("Durante todo el proceso Vercel y Supabase quedan intactos. Si una aplicación falla en el corte y no se resuelve en la ventana, se quita el registro DNS nuevo y se reactiva el despliegue en Vercel: los usuarios vuelven al sistema anterior sin pérdida de datos."));
c.push(h2("Impacto para los usuarios"));
[
  "**Gestión de Proyectos y Horas Extra:** iniciar sesión de nuevo una vez. Se conservan contraseñas, cuentas de Google, perfiles y permisos.",
  "**Bocas, Inasistencias y Oficinas:** sin cambios más allá de la dirección nueva.",
  "Durante la ventana de corte de cada app (estimada en minutos, según el volumen relevado) la app no admite cambios.",
].forEach((t) => c.push(vineta(t)));

// 6
c.push(h1("6. Requisitos a cargo del PJ"));
c.push(...tabla(["Requisito", "Detalle"], [
  ["Servidor", "VM Ubuntu 24.04 LTS, 8 vCPU, 16 GB RAM, 200 GB SSD, IP fija en la red interna"],
  ["DNS interno", "8 registros apuntando al servidor (sección 4)"],
  ["Certificado", "Wildcard o con todos los nombres, más la CA raíz que lo emite"],
  ["Salida a internet", "GitHub, npm, Docker Hub, Google Fonts (despliegues); Google OAuth, SMTP y Resend (operación)"],
  ["Accesos", "Vercel (5 proyectos); Supabase de Horas Extra y Bocas; contraseña de la base de cada proyecto Supabase (o su restablecimiento por el propietario); repositorios GitHub; consola de Google Cloud del login de Horas Extra; cuentas Brevo y Resend"],
  ["Backups", "Destino fuera del servidor (NAS u otro equipo) para la copia diaria"],
  ["Ventanas de corte", "Fecha y hora por aplicación, y un usuario clave por app para la validación funcional"],
], [25, 75]));

// 7
c.push(h1("7. Próximos pasos"));
c.push(...tabla(["#", "Acción", "Responsable", "Horas"], [
  ["1", "Aprobar la arquitectura y el plan", "PJ", "Antes del inicio"],
  ["2", "Proveer servidor, DNS, certificado y accesos (sección 6)", "PJ — Infraestructura", "Antes del inicio"],
  ["3", "Completar el relevamiento: Horas Extra, Bocas y Vercel (Gestión e Inasistencias, hecho el 28/10)", "PROCOM IT SOLUTIONS", "1"],
  ["4", "Preparar el servidor y desplegar los stacks vacíos", "PROCOM IT SOLUTIONS", "2"],
  ["5", "Ensayo de migración y validación con usuarios clave", "PROCOM IT SOLUTIONS + PJ", "3"],
  ["6", "Corte por aplicación según ventanas acordadas", "PROCOM IT SOLUTIONS + PJ", "3"],
  ["7", "Backups programados, prueba de restauración y cierre", "PROCOM IT SOLUTIONS", "1"],
  ["", "**Total del proyecto**", "", "**10**"],
], [6, 50, 26, 18]));
c.push(pSuave("Las horas son estimadas y se ajustan con los volúmenes que surjan del relevamiento. No incluyen los tiempos de espera a cargo del PJ (accesos, aprobaciones y ventanas de corte)."));

// Anexo A
c.push(salto());
c.push(h1("Anexo A — Validación en laboratorio"));
c.push(p("Los archivos de la nueva infraestructura se probaron en un entorno de laboratorio con datos simulados. Resultados:"));
c.push(...tabla(["Prueba", "Resultado"], validaciones("migracion"), [75, 25]));
c.push(p("Las pruebas con credenciales reales (login con Google, envío de mails, volúmenes productivos) se hacen en el ensayo de la Fase 3."));

// Anexo B
c.push(h1("Anexo B — Entregables"));
c.push(...tabla(["Entregable", "Contenido"], [
  ["Infraestructura como código", "Configuración de cada aplicación en su propio stack, con versiones fijadas; proxy de entrada con la guía para publicar aplicaciones nuevas; configuración oficial de Supabase para instalación propia"],
  ["Herramientas de migración y operación", "Generación de claves, relevamiento, exportación, carga, copia de archivos, validación, backup y despliegue"],
  ["Procedimiento de migración", "Paso a paso de cada fase, con verificaciones y vuelta atrás"],
  ["Diagrama de arquitectura", "Editable, para mantenerlo actualizado"],
  ["Relevamiento de Supabase Cloud", "Estado de los proyectos de Gestión e Inasistencias y su impacto en la migración"],
], [30, 70]));

await guardar({
  titulo: "Migración de aplicaciones a infraestructura propia",
  subtitulo: "Propuesta técnica — Migración de Vercel + Supabase a servidor Docker on-premise",
  fechaVersion: "28 de octubre de 2026 · Versión 1.0",
  cuerpo: c,
});
